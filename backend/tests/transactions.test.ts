import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DATA, Tx, api, bearer, bootstrap, loginToken, teardown } from './helpers';

let token: string;
beforeAll(async () => {
  await bootstrap();
  token = await loginToken();
});
afterAll(teardown);

const auth = () => bearer(token);

/** Same tie-break the API uses: primary field, then id ascending (id sort has no secondary key). */
function expectedOrder(field: keyof Tx, order: 'asc' | 'desc'): Tx[] {
  const dir = order === 'asc' ? 1 : -1;
  return [...DATA].sort((a, b) => {
    const av = a[field];
    const bv = b[field];
    const cmp = av < bv ? -1 : av > bv ? 1 : 0;
    if (cmp !== 0) return cmp * dir;
    return field === 'id' ? 0 : a.id - b.id;
  });
}

/** Mirrors filterBuilder.ts search semantics, computed independently from the dataset. */
function searchMatches(term: string): Tx[] {
  const t = term.toLowerCase();
  const isNumeric = /^\d+(\.\d+)?$/.test(term);
  const dateMatch = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/.exec(term);
  return DATA.filter((r) => {
    if (r.category.toLowerCase().includes(t)) return true;
    if (r.status.toLowerCase().includes(t)) return true;
    if (r.user_id.toLowerCase().includes(t)) return true;
    if (isNumeric) {
      const n = Number(term);
      if (r.amount === n) return true;
      if (Number.isInteger(n) && r.id === n) return true;
    }
    if (dateMatch) {
      const year = Number(dateMatch[1]);
      const month = dateMatch[2] ? Number(dateMatch[2]) : undefined;
      const day = dateMatch[3] ? Number(dateMatch[3]) : undefined;
      const d = new Date(r.date);
      if (d.getUTCFullYear() !== year) return false;
      if (month !== undefined && d.getUTCMonth() + 1 !== month) return false;
      if (day !== undefined && d.getUTCDate() !== day) return false;
      return true;
    }
    return false;
  });
}

async function fetchAllPages(qs: string): Promise<Tx[]> {
  const pageSize = 100;
  let page = 1;
  const out: Tx[] = [];
  for (;;) {
    const res = await api()
      .get(`/api/transactions?${qs}&page=${page}&pageSize=${pageSize}`)
      .set(auth());
    expect(res.status).toBe(200);
    out.push(...res.body.data);
    if (page >= res.body.pagination.totalPages) break;
    page += 1;
  }
  return out;
}

describe('GET /api/transactions', () => {
  it('defaults to sort by date desc and returns pagination metadata', async () => {
    const res = await api().get('/api/transactions?pageSize=5').set(auth());
    expect(res.status).toBe(200);
    expect(res.body.pagination).toEqual({ page: 1, pageSize: 5, total: 300, totalPages: 60 });
    const expected = expectedOrder('date', 'desc').slice(0, 5).map((t) => t.id);
    expect(res.body.data.map((t: Tx) => t.id)).toEqual(expected);
  });

  it('pagination covers all 300 unique ids with no gaps or overlaps', async () => {
    const all = await fetchAllPages('sortBy=id&sortOrder=asc');
    expect(all).toHaveLength(300);
    const ids = all.map((t) => t.id);
    expect(new Set(ids).size).toBe(300);
    expect(ids).toEqual(DATA.map((t) => t.id).sort((a, b) => a - b));
  });

  it.each(['id', 'date', 'amount', 'category', 'status', 'user_id', 'user_profile'] as const)(
    'sorts by %s asc and desc',
    async (field) => {
      for (const order of ['asc', 'desc'] as const) {
        const all = await fetchAllPages(`sortBy=${field}&sortOrder=${order}`);
        const expected = expectedOrder(field, order).map((t) => t.id);
        expect(all.map((t) => t.id)).toEqual(expected);
      }
    },
  );

  it('filters by category', async () => {
    const res = await api().get('/api/transactions?category=Revenue&pageSize=1').set(auth());
    expect(res.body.pagination.total).toBe(DATA.filter((t) => t.category === 'Revenue').length);
    expect(res.body.pagination.total).toBe(150);
  });

  it('filters by status', async () => {
    const res = await api().get('/api/transactions?status=Paid&pageSize=1').set(auth());
    expect(res.body.pagination.total).toBe(186);
  });

  it('filters by user_id', async () => {
    const res = await api().get('/api/transactions?user_id=user_003&pageSize=1').set(auth());
    expect(res.body.pagination.total).toBe(DATA.filter((t) => t.user_id === 'user_003').length);
  });

  it('filters by date range', async () => {
    const res = await api().get('/api/transactions?dateFrom=2024-03-01&dateTo=2024-03-31&pageSize=1').set(auth());
    const expected = DATA.filter((t) => t.date >= '2024-03-01T00:00:00.000Z' && t.date <= '2024-03-31T23:59:59.999Z').length;
    expect(res.body.pagination.total).toBe(expected);
  });

  it('filters by amount range', async () => {
    const res = await api().get('/api/transactions?minAmount=1000&maxAmount=2000&pageSize=1').set(auth());
    const expected = DATA.filter((t) => t.amount >= 1000 && t.amount <= 2000).length;
    expect(res.body.pagination.total).toBe(expected);
  });

  it('combines multiple filters with AND semantics', async () => {
    const res = await api().get('/api/transactions?category=Revenue&status=Pending&user_id=user_001&pageSize=1').set(auth());
    const expected = DATA.filter(
      (t) => t.category === 'Revenue' && t.status === 'Pending' && t.user_id === 'user_001',
    ).length;
    expect(res.body.pagination.total).toBe(expected);
  });

  it.each(['paid', 'user_003', '2024-03', '42', '1500'])('search "%s" matches the expected rows', async (term) => {
    const res = await api()
      .get(`/api/transactions?search=${encodeURIComponent(term)}&pageSize=1`)
      .set(auth());
    expect(res.status).toBe(200);
    expect(res.body.pagination.total).toBe(searchMatches(term).length);
  });

  describe('validation', () => {
    it('rejects dateFrom after dateTo', async () => {
      const res = await api().get('/api/transactions?dateFrom=2024-06-01&dateTo=2024-01-01').set(auth());
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects pageSize over the max', async () => {
      const res = await api().get('/api/transactions?pageSize=1000').set(auth());
      expect(res.status).toBe(400);
    });

    it('rejects an unknown sortBy', async () => {
      const res = await api().get('/api/transactions?sortBy=notAField').set(auth());
      expect(res.status).toBe(400);
    });
  });
});

describe('GET /api/transactions/filter-options', () => {
  it('reflects the dataset exactly', async () => {
    const res = await api().get('/api/transactions/filter-options').set(auth());
    expect(res.status).toBe(200);
    expect(res.body.categories).toEqual(['Expense', 'Revenue']);
    expect(res.body.statuses).toEqual(['Paid', 'Pending']);
    expect(res.body.userIds).toEqual(['user_001', 'user_002', 'user_003', 'user_004']);
    expect(res.body.totalCount).toBe(300);
    expect(res.body.amountRange.min).toBe(Math.min(...DATA.map((t) => t.amount)));
    expect(res.body.amountRange.max).toBe(Math.max(...DATA.map((t) => t.amount)));
  });
});
