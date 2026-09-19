import { Sort } from 'mongodb';
import { TransactionDoc, transactions } from '../models/transaction';
import { ListQuery, TransactionFilters } from '../validation/schemas';
import { buildFilter } from './filterBuilder';

export interface TransactionDto {
  id: number;
  date: string;
  amount: number;
  category: TransactionDoc['category'];
  status: string;
  user_id: string;
  user_profile: string;
}

export const toDto = (d: TransactionDoc): TransactionDto => ({
  id: d.id,
  date: d.date.toISOString(),
  amount: d.amount,
  category: d.category,
  status: d.status,
  user_id: d.user_id,
  user_profile: d.user_profile,
});

/** Sort with `id` as a deterministic tie-breaker so pages never overlap or skip rows. */
export function buildSort(sortBy: string, sortOrder: 'asc' | 'desc'): Sort {
  const dir = sortOrder === 'asc' ? 1 : -1;
  return sortBy === 'id' ? { id: dir } : { [sortBy]: dir, id: 1 };
}

export async function listTransactions(q: ListQuery) {
  const filter = buildFilter(q);
  const coll = transactions();
  const [docs, total] = await Promise.all([
    coll
      .find(filter, { projection: { _id: 0, month: 0 } })
      .sort(buildSort(q.sortBy, q.sortOrder))
      .skip((q.page - 1) * q.pageSize)
      .limit(q.pageSize)
      .toArray(),
    coll.countDocuments(filter),
  ]);
  return {
    data: (docs as TransactionDoc[]).map(toDto),
    pagination: { page: q.page, pageSize: q.pageSize, total, totalPages: Math.max(1, Math.ceil(total / q.pageSize)) },
  };
}

export async function countTransactions(f: TransactionFilters): Promise<number> {
  return transactions().countDocuments(buildFilter(f));
}

/** Everything the filter UI needs, derived from what is actually stored. */
export async function getFilterOptions() {
  const coll = transactions();
  const [categories, statuses, userIds, total, firstByDate, lastByDate, minAmt, maxAmt] = await Promise.all([
    coll.distinct('category'),
    coll.distinct('status'),
    coll.distinct('user_id'),
    coll.estimatedDocumentCount(),
    coll.find({}, { projection: { date: 1 } }).sort({ date: 1 }).limit(1).toArray(),
    coll.find({}, { projection: { date: 1 } }).sort({ date: -1 }).limit(1).toArray(),
    coll.find({}, { projection: { amount: 1 } }).sort({ amount: 1 }).limit(1).toArray(),
    coll.find({}, { projection: { amount: 1 } }).sort({ amount: -1 }).limit(1).toArray(),
  ]);
  return {
    categories: [...categories].sort(),
    statuses: [...statuses].sort(),
    userIds: [...userIds].sort(),
    totalCount: total,
    dateRange: { min: firstByDate[0]?.date.toISOString() ?? null, max: lastByDate[0]?.date.toISOString() ?? null },
    amountRange: { min: minAmt[0]?.amount ?? null, max: maxAmt[0]?.amount ?? null },
  };
}
