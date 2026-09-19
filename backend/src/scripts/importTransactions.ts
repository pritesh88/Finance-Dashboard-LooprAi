import { z } from 'zod';
import { CATEGORIES, TransactionDoc, monthKey, transactions } from '../models/transaction';

/** Shape of one record in transactions.json (verified against the provided file). */
const recordSchema = z.object({
  id: z.number().int().positive(),
  date: z.string().datetime({ message: 'date must be an ISO-8601 UTC timestamp' }),
  amount: z.number().finite().positive(),
  category: z.enum(CATEGORIES),
  status: z.string().min(1),
  user_id: z.string().min(1),
  user_profile: z.string().min(1),
});

export interface ImportResult {
  total: number;
  inserted: number;
  updated: number;
  unchanged: number;
}

const sameDoc = (a: TransactionDoc, b: TransactionDoc) =>
  a.date.getTime() === b.date.getTime() &&
  a.amount === b.amount &&
  a.category === b.category &&
  a.status === b.status &&
  a.user_id === b.user_id &&
  a.user_profile === b.user_profile &&
  a.month === b.month;

/**
 * Validates every record up-front (all-or-nothing), then syncs by `id`:
 * new ids are inserted in one batch, changed records are replaced, identical
 * records are left alone. Re-running with the same file therefore performs no writes.
 */
export async function importTransactions(raw: unknown, opts: { reset?: boolean } = {}): Promise<ImportResult> {
  const parsed = z.array(z.unknown()).safeParse(raw);
  if (!parsed.success) throw new Error('Dataset must be a JSON array of transactions');

  const docs: TransactionDoc[] = [];
  const problems: string[] = [];
  const seen = new Set<number>();
  parsed.data.forEach((item, i) => {
    const r = recordSchema.safeParse(item);
    if (!r.success) {
      problems.push(`record #${i}: ${r.error.issues.map((x) => `${x.path.join('.')}: ${x.message}`).join('; ')}`);
      return;
    }
    if (seen.has(r.data.id)) {
      problems.push(`record #${i}: duplicate id ${r.data.id}`);
      return;
    }
    seen.add(r.data.id);
    const date = new Date(r.data.date);
    docs.push({ ...r.data, date, month: monthKey(date) });
  });
  if (problems.length) {
    throw new Error(`Dataset validation failed (${problems.length} problem(s)):\n  ${problems.slice(0, 10).join('\n  ')}`);
  }

  const coll = transactions();
  if (opts.reset) await coll.deleteMany({});

  const existing = new Map<number, TransactionDoc>();
  for (const d of await coll.find({}, { projection: { _id: 0 } }).toArray()) existing.set(d.id, d as TransactionDoc);

  const toInsert = docs.filter((d) => !existing.has(d.id));
  const toReplace = docs.filter((d) => existing.has(d.id) && !sameDoc(existing.get(d.id)!, d));

  if (toInsert.length) await coll.insertMany(toInsert, { ordered: false });
  for (const d of toReplace) await coll.replaceOne({ id: d.id }, d);

  return {
    total: docs.length,
    inserted: toInsert.length,
    updated: toReplace.length,
    unchanged: docs.length - toInsert.length - toReplace.length,
  };
}
