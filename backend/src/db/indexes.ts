import { transactions } from '../models/transaction';
import { users } from '../models/user';

/**
 * Indexes are chosen from the actual query shapes:
 *  - id            unique; default tie-breaker for stable pagination, exact search
 *  - date          date-range filter + default sort
 *  - amount        range filter + sort
 *  - month         monthly trend $group / $match
 *  - category/status/user_id + date   equality/$in filters combined with date sort/range
 */
export async function ensureIndexes(): Promise<void> {
  const t = transactions();
  // Created sequentially: index builds are one-off startup work, and this keeps
  // the script portable to Mongo-compatible servers that serialize DDL.
  await t.createIndex({ id: 1 }, { unique: true, name: 'uniq_id' });
  await t.createIndex({ date: -1 }, { name: 'date_desc' });
  await t.createIndex({ amount: 1 }, { name: 'amount' });
  await t.createIndex({ month: 1 }, { name: 'month' });
  await t.createIndex({ category: 1, date: -1 }, { name: 'category_date' });
  await t.createIndex({ status: 1, date: -1 }, { name: 'status_date' });
  await t.createIndex({ user_id: 1, date: -1 }, { name: 'user_date' });
  await users().createIndex({ email: 1 }, { unique: true, name: 'uniq_email' });
}
