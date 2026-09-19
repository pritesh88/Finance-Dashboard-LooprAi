import { transactions } from '../models/transaction';
import { TransactionFilters } from '../validation/schemas';
import { buildFilter } from './filterBuilder';

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

interface Group<K> {
  _id: K;
  amount: number;
  count: number;
}

/** "2024-01" -> next month key, without touching Date/timezones. */
function nextMonth(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
}

/**
 * Dashboard analytics for the rows matching `filters`.
 * Six small $match + $group aggregations run in parallel; MongoDB reduces the
 * data to at most (categories x statuses), (months x categories) and
 * (users x categories) groups, and only that reduced result is post-processed.
 *
 * Each dimension is grouped with TWO separate single-accumulator pipelines
 * (one `$sum: '$amount'`, one `$count: {}`) instead of one pipeline with both
 * accumulators, then merged in `mergeGroups` below. Both accumulators are
 * standard MongoDB and a single combined `$group` is the more natural way to
 * write this; it was split only because the Mongo-compatible database used in
 * this environment (see README "Environment notes") silently returns 0 for
 * every accumulator field after the first one in a multi-accumulator $group.
 * Splitting is a portable, harmless change (still pure $match + $group, just
 * two round trips instead of one) that works identically against real MongoDB.
 *
 * Domain rule (derived from the dataset): every amount is positive and the
 * `category` field carries the sign. Revenue adds to net income, Expense subtracts.
 */
export async function getDashboard(filters: TransactionFilters) {
  const match = buildFilter(filters);
  const coll = transactions();

  function mergeGroups<K>(amounts: { _id: K; amount: number }[], counts: { _id: K; count: number }[]): Group<K>[] {
    const byKey = new Map<string, Group<K>>();
    for (const a of amounts) byKey.set(JSON.stringify(a._id), { _id: a._id, amount: a.amount, count: 0 });
    for (const c of counts) {
      const k = JSON.stringify(c._id);
      const existing = byKey.get(k);
      if (existing) existing.count = c.count;
      else byKey.set(k, { _id: c._id, amount: 0, count: c.count });
    }
    return [...byKey.values()];
  }

  async function groupBy<K>(key: Record<string, string>): Promise<Group<K>[]> {
    const [amounts, counts] = await Promise.all([
      coll.aggregate<{ _id: K; amount: number }>([{ $match: match }, { $group: { _id: key, amount: { $sum: '$amount' } } }]).toArray(),
      coll.aggregate<{ _id: K; count: number }>([{ $match: match }, { $group: { _id: key, count: { $count: {} } } }]).toArray(),
    ]);
    return mergeGroups(amounts, counts);
  }

  const [byCatStatus, byMonthCat, byUserCat] = await Promise.all([
    groupBy<{ category: string; status: string }>({ category: '$category', status: '$status' }),
    groupBy<{ month: string; category: string }>({ month: '$month', category: '$category' }),
    groupBy<{ user_id: string; category: string }>({ user_id: '$user_id', category: '$category' }),
  ]);

  // ---- summary + category breakdown -------------------------------------
  let revenue = 0, expenses = 0, revenueCount = 0, expenseCount = 0, pendingRevenue = 0, pendingExpenses = 0, pendingCount = 0;
  let totalAmount = 0, count = 0;
  const statusTotals = new Map<string, { amount: number; count: number }>();
  const catTotals = new Map<string, { amount: number; count: number }>();

  for (const g of byCatStatus) {
    const { category, status } = g._id;
    count += g.count;
    totalAmount += g.amount;
    if (category === 'Revenue') { revenue += g.amount; revenueCount += g.count; }
    if (category === 'Expense') { expenses += g.amount; expenseCount += g.count; }
    if (status === 'Pending') {
      pendingCount += g.count;
      if (category === 'Revenue') pendingRevenue += g.amount;
      if (category === 'Expense') pendingExpenses += g.amount;
    }
    const s = statusTotals.get(status) ?? { amount: 0, count: 0 };
    statusTotals.set(status, { amount: s.amount + g.amount, count: s.count + g.count });
    const c = catTotals.get(category) ?? { amount: 0, count: 0 };
    catTotals.set(category, { amount: c.amount + g.amount, count: c.count + g.count });
  }

  const summary = {
    totalRevenue: r2(revenue),
    totalExpenses: r2(expenses),
    netIncome: r2(revenue - expenses),
    transactionCount: count,
    revenueCount,
    expenseCount,
    averageAmount: count ? r2(totalAmount / count) : 0,
    pendingRevenue: r2(pendingRevenue),
    pendingExpenses: r2(pendingExpenses),
    pendingCount,
  };

  const categories = [...catTotals.entries()]
    .map(([category, v]) => ({
      category,
      amount: r2(v.amount),
      count: v.count,
      share: totalAmount ? Math.round((v.amount / totalAmount) * 10000) / 10000 : 0,
    }))
    .sort((a, b) => a.category.localeCompare(b.category));

  const statuses = [...statusTotals.entries()]
    .map(([status, v]) => ({ status, amount: r2(v.amount), count: v.count }))
    .sort((a, b) => a.status.localeCompare(b.status));

  // ---- monthly trend (gaps between first and last month filled with 0) ---
  const monthMap = new Map<string, { revenue: number; expenses: number }>();
  for (const g of byMonthCat) {
    const m = monthMap.get(g._id.month) ?? { revenue: 0, expenses: 0 };
    if (g._id.category === 'Revenue') m.revenue += g.amount;
    if (g._id.category === 'Expense') m.expenses += g.amount;
    monthMap.set(g._id.month, m);
  }
  const trend: { month: string; revenue: number; expenses: number; net: number }[] = [];
  const keys = [...monthMap.keys()].sort();
  if (keys.length) {
    for (let k = keys[0]; k <= keys[keys.length - 1]; k = nextMonth(k)) {
      const m = monthMap.get(k) ?? { revenue: 0, expenses: 0 };
      trend.push({ month: k, revenue: r2(m.revenue), expenses: r2(m.expenses), net: r2(m.revenue - m.expenses) });
    }
  }

  // ---- per-user split ----------------------------------------------------
  const userMap = new Map<string, { revenue: number; expenses: number; count: number }>();
  for (const g of byUserCat) {
    const u = userMap.get(g._id.user_id) ?? { revenue: 0, expenses: 0, count: 0 };
    if (g._id.category === 'Revenue') u.revenue += g.amount;
    if (g._id.category === 'Expense') u.expenses += g.amount;
    u.count += g.count;
    userMap.set(g._id.user_id, u);
  }
  const users = [...userMap.entries()]
    .map(([user_id, u]) => ({ user_id, revenue: r2(u.revenue), expenses: r2(u.expenses), count: u.count }))
    .sort((a, b) => a.user_id.localeCompare(b.user_id));

  return { summary, trend, categories, statuses, users };
}
