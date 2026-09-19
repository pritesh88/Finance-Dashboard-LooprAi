import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DATA, api, bearer, bootstrap, loginToken, round2, sum, teardown } from './helpers';

let token: string;
beforeAll(async () => {
  await bootstrap();
  token = await loginToken();
});
afterAll(teardown);

const auth = () => bearer(token);

describe('GET /api/dashboard', () => {
  it('unfiltered totals match the verified dataset facts', async () => {
    const res = await api().get('/api/dashboard').set(auth());
    expect(res.status).toBe(200);
    const { summary } = res.body;
    expect(summary.totalRevenue).toBe(339803.25);
    expect(summary.totalExpenses).toBe(206605);
    expect(summary.netIncome).toBe(133198.25);
    expect(summary.transactionCount).toBe(300);
    expect(summary.revenueCount).toBe(150);
    expect(summary.expenseCount).toBe(150);
  });

  it('trend has one entry per month in range and sums back to the totals', async () => {
    const res = await api().get('/api/dashboard').set(auth());
    const { trend, summary } = res.body;
    expect(trend).toHaveLength(12);
    expect(trend.map((m: { month: string }) => m.month)).toEqual([
      '2024-01', '2024-02', '2024-03', '2024-04', '2024-05', '2024-06',
      '2024-07', '2024-08', '2024-09', '2024-10', '2024-11', '2024-12',
    ]);
    const revenueSum = round2(trend.reduce((s: number, m: { revenue: number }) => s + m.revenue, 0));
    const expenseSum = round2(trend.reduce((s: number, m: { expenses: number }) => s + m.expenses, 0));
    expect(revenueSum).toBe(summary.totalRevenue);
    expect(expenseSum).toBe(summary.totalExpenses);
  });

  it('category and status breakdowns match independently-computed sums', async () => {
    const res = await api().get('/api/dashboard').set(auth());
    const { categories, statuses } = res.body;
    const revenue = categories.find((c: { category: string }) => c.category === 'Revenue');
    const expense = categories.find((c: { category: string }) => c.category === 'Expense');
    expect(revenue.amount).toBe(sum(DATA.filter((t) => t.category === 'Revenue')));
    expect(revenue.count).toBe(150);
    expect(expense.amount).toBe(sum(DATA.filter((t) => t.category === 'Expense')));
    expect(expense.count).toBe(150);

    const paid = statuses.find((s: { status: string }) => s.status === 'Paid');
    const pending = statuses.find((s: { status: string }) => s.status === 'Pending');
    expect(paid.count).toBe(186);
    expect(pending.count).toBe(114);
    expect(paid.amount).toBe(sum(DATA.filter((t) => t.status === 'Paid')));
    expect(pending.amount).toBe(sum(DATA.filter((t) => t.status === 'Pending')));
  });

  it('per-user split sums back to the totals', async () => {
    const res = await api().get('/api/dashboard').set(auth());
    const { users, summary } = res.body;
    expect(users).toHaveLength(4);
    const revenueSum = round2(users.reduce((s: number, u: { revenue: number }) => s + u.revenue, 0));
    const expenseSum = round2(users.reduce((s: number, u: { expenses: number }) => s + u.expenses, 0));
    const countSum = users.reduce((s: number, u: { count: number }) => s + u.count, 0);
    expect(revenueSum).toBe(summary.totalRevenue);
    expect(expenseSum).toBe(summary.totalExpenses);
    expect(countSum).toBe(300);
  });

  it('applies filters to every figure', async () => {
    const res = await api().get('/api/dashboard?category=Revenue').set(auth());
    expect(res.body.summary.totalExpenses).toBe(0);
    expect(res.body.summary.totalRevenue).toBe(339803.25);
    expect(res.body.summary.expenseCount).toBe(0);
    expect(res.body.categories.find((c: { category: string }) => c.category === 'Expense')).toBeUndefined();
  });

  it('an impossible filter returns zeroed summary and an empty trend', async () => {
    const res = await api().get('/api/dashboard?minAmount=999999').set(auth());
    expect(res.status).toBe(200);
    expect(res.body.summary).toEqual({
      totalRevenue: 0,
      totalExpenses: 0,
      netIncome: 0,
      transactionCount: 0,
      revenueCount: 0,
      expenseCount: 0,
      averageAmount: 0,
      pendingRevenue: 0,
      pendingExpenses: 0,
      pendingCount: 0,
    });
    expect(res.body.trend).toEqual([]);
    expect(res.body.categories).toEqual([]);
    expect(res.body.statuses).toEqual([]);
    expect(res.body.users).toEqual([]);
  });
});
