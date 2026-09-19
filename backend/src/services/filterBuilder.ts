import { Filter } from 'mongodb';
import { TransactionDoc } from '../models/transaction';
import { TransactionFilters } from '../validation/schemas';

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const startOfDay = (ymd: string) => new Date(`${ymd}T00:00:00.000Z`);
const endOfDay = (ymd: string) => new Date(`${ymd}T23:59:59.999Z`);

/**
 * Turns "2024", "2024-03" or "2024-03-15" into a half-open UTC range so users
 * can search dates by typing them. Returns null for anything else.
 */
function dateRangeFromSearch(term: string): { $gte: Date; $lt: Date } | null {
  const m = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/.exec(term);
  if (!m) return null;
  const year = Number(m[1]);
  const month = m[2] ? Number(m[2]) : undefined;
  const day = m[3] ? Number(m[3]) : undefined;
  if (month !== undefined && (month < 1 || month > 12)) return null;

  let from: Date;
  let to: Date;
  if (day !== undefined) {
    from = new Date(Date.UTC(year, month! - 1, day));
    if (from.getUTCDate() !== day) return null; // e.g. 2024-02-31
    to = new Date(Date.UTC(year, month! - 1, day + 1));
  } else if (month !== undefined) {
    from = new Date(Date.UTC(year, month - 1, 1));
    to = new Date(Date.UTC(year, month, 1));
  } else {
    from = new Date(Date.UTC(year, 0, 1));
    to = new Date(Date.UTC(year + 1, 0, 1));
  }
  return { $gte: from, $lt: to };
}

/**
 * Builds the MongoDB filter shared by the list, dashboard and export endpoints,
 * so the table, the charts and the CSV always describe the same set of rows.
 *
 * Search semantics (case-insensitive):
 *  - substring match on category, status and user_id
 *  - a numeric term also matches `id` and `amount` exactly
 *  - a date-like term (YYYY, YYYY-MM, YYYY-MM-DD) matches transactions in that UTC period
 */
export function buildFilter(f: TransactionFilters): Filter<TransactionDoc> {
  const and: Filter<TransactionDoc>[] = [];

  if (f.category?.length) and.push({ category: { $in: f.category as TransactionDoc['category'][] } });
  if (f.status?.length) and.push({ status: { $in: f.status } });
  if (f.user_id?.length) and.push({ user_id: { $in: f.user_id } });

  if (f.dateFrom || f.dateTo) {
    const range: { $gte?: Date; $lte?: Date } = {};
    if (f.dateFrom) range.$gte = startOfDay(f.dateFrom);
    if (f.dateTo) range.$lte = endOfDay(f.dateTo);
    and.push({ date: range });
  }

  if (f.minAmount !== undefined || f.maxAmount !== undefined) {
    const range: { $gte?: number; $lte?: number } = {};
    if (f.minAmount !== undefined) range.$gte = f.minAmount;
    if (f.maxAmount !== undefined) range.$lte = f.maxAmount;
    and.push({ amount: range });
  }

  if (f.search) {
    const term = f.search.trim();
    const rx = new RegExp(escapeRegex(term), 'i');
    const or: Filter<TransactionDoc>[] = [{ category: rx }, { status: rx }, { user_id: rx }];
    if (/^\d+(\.\d+)?$/.test(term)) {
      const n = Number(term);
      or.push({ amount: n });
      if (Number.isInteger(n)) or.push({ id: n });
    }
    const range = dateRangeFromSearch(term);
    if (range) or.push({ date: range });
    and.push({ $or: or });
  }

  return and.length ? { $and: and } : {};
}
