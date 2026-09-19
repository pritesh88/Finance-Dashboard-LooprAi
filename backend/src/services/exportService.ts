import { stringify } from 'csv-stringify/sync';
import { env } from '../config/env';
import { FIELD_LABELS, TransactionDoc, TransactionField, transactions } from '../models/transaction';
import { ExportBody } from '../validation/schemas';
import { AppError } from '../utils/errors';
import { buildFilter } from './filterBuilder';
import { buildSort } from './transactionService';

/**
 * Text cells starting with = + - @ (or tab/CR) can be executed as formulas by
 * Excel/Sheets ("CSV injection"). Prefix them with an apostrophe. Numeric
 * columns are formatted by us and are never affected.
 */
const neutralize = (s: string) => (/^[=+\-@\t\r]/.test(s) ? `'${s}` : s);

const CELL: Record<TransactionField, (d: TransactionDoc) => string> = {
  id: (d) => String(d.id),
  date: (d) => d.date.toISOString().replace('.000Z', 'Z'), // same format as the source data
  amount: (d) => d.amount.toFixed(2),
  category: (d) => neutralize(d.category),
  status: (d) => neutralize(d.status),
  user_id: (d) => neutralize(d.user_id),
  user_profile: (d) => neutralize(d.user_profile),
};

const rowFor = (d: TransactionDoc, columns: readonly TransactionField[]) => columns.map((c) => CELL[c](d));

function query(body: ExportBody) {
  // "all" ignores the current filters/search on purpose (that is what the scope means).
  const filter = body.scope === 'all' ? {} : buildFilter(body.filters);
  return { filter, sort: buildSort(body.sortBy, body.sortOrder) };
}

export async function generateCsv(body: ExportBody) {
  const { filter, sort } = query(body);
  const docs = await transactions()
    .find(filter, { projection: { _id: 0 } })
    .sort(sort)
    .limit(env.MAX_EXPORT_ROWS + 1)
    .toArray();
  if (docs.length > env.MAX_EXPORT_ROWS) {
    throw AppError.tooLarge(`Export exceeds the ${env.MAX_EXPORT_ROWS} row limit. Narrow your filters and try again.`);
  }
  const csv = stringify(
    docs.map((d) => rowFor(d, body.columns)),
    {
      header: true,
      columns: body.columns.map((c) => ({ key: c, header: FIELD_LABELS[c] })),
      record_delimiter: 'windows', // RFC 4180: CRLF
    },
  );
  const stamp = new Date().toISOString().slice(0, 10);
  return { csv, rowCount: docs.length, filename: `transactions_${stamp}.csv` };
}

/** First rows + total row count, formatted by the exact same cell functions as the real export. */
export async function previewCsv(body: ExportBody, limit = 5) {
  const { filter, sort } = query(body);
  const coll = transactions();
  const [docs, totalRows] = await Promise.all([
    coll.find(filter, { projection: { _id: 0 } }).sort(sort).limit(limit).toArray(),
    coll.countDocuments(filter),
  ]);
  return {
    columns: body.columns.map((c) => ({ key: c, label: FIELD_LABELS[c] })),
    rows: docs.map((d) => rowFor(d, body.columns)),
    totalRows,
  };
}
