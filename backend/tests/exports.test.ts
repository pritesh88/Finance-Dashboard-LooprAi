import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { transactions } from '../src/models/transaction';
import { DATA, api, bearer, bootstrap, loginToken, teardown } from './helpers';

let token: string;
beforeAll(async () => {
  await bootstrap();
  token = await loginToken();
});
afterAll(teardown);

const auth = () => bearer(token);

describe('POST /api/exports/csv/preview', () => {
  it('returns columns in the requested order, formatted rows and a total count', async () => {
    const res = await api()
      .post('/api/exports/csv/preview')
      .set(auth())
      .send({ columns: ['status', 'id', 'amount'], scope: 'filtered', filters: { category: ['Revenue'] } });
    expect(res.status).toBe(200);
    expect(res.body.columns).toEqual([
      { key: 'status', label: 'Status' },
      { key: 'id', label: 'ID' },
      { key: 'amount', label: 'Amount' },
    ]);
    expect(res.body.totalRows).toBe(150);
    expect(res.body.rows.length).toBeLessThanOrEqual(5);
    for (const row of res.body.rows) expect(row).toHaveLength(3);
  });

  it('rejects an empty column list', async () => {
    const res = await api().post('/api/exports/csv/preview').set(auth()).send({ columns: [] });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('POST /api/exports/csv', () => {
  it('produces a CRLF CSV with a matching header row and Content-Disposition', async () => {
    const res = await api()
      .post('/api/exports/csv')
      .set(auth())
      .send({ columns: ['id', 'date', 'amount', 'category', 'status', 'user_id', 'user_profile'] });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.headers['content-disposition']).toMatch(/attachment; filename="transactions_\d{4}-\d{2}-\d{2}\.csv"/);
    expect(res.headers['x-total-rows']).toBe('300');

    const text: string = res.text;
    expect(text.includes('\r\n')).toBe(true);
    const lines = text.split('\r\n').filter(Boolean);
    expect(lines[0]).toBe('ID,Date,Amount,Category,Status,User ID,User Profile');
    // header + 300 data rows
    expect(lines).toHaveLength(301);
  });

  it('scope "filtered" honors the active filters; scope "all" ignores them', async () => {
    const filtered = await api()
      .post('/api/exports/csv')
      .set(auth())
      .send({ columns: ['id'], scope: 'filtered', filters: { category: ['Revenue'] } });
    expect(filtered.headers['x-total-rows']).toBe('150');

    const all = await api()
      .post('/api/exports/csv')
      .set(auth())
      .send({ columns: ['id'], scope: 'all', filters: { category: ['Revenue'] } });
    expect(all.headers['x-total-rows']).toBe('300');
  });

  it('rejects an empty column list with 400', async () => {
    const res = await api().post('/api/exports/csv').set(auth()).send({ columns: [] });
    expect(res.status).toBe(400);
  });

  it('neutralizes formula-injection payloads in text columns', async () => {
    const coll = transactions();
    const injected = {
      id: 999001,
      date: new Date('2024-06-15T00:00:00.000Z'),
      amount: 500,
      category: 'Revenue' as const,
      status: '=SUM(A1:A9)',
      user_id: '+CMD|cmd',
      user_profile: '-9+9',
      month: '2024-06',
    };
    await coll.insertOne(injected);
    try {
      const res = await api()
        .post('/api/exports/csv')
        .set(auth())
        .send({ columns: ['id', 'status', 'user_id', 'user_profile'], scope: 'filtered', filters: { search: '999001' } });
      expect(res.status).toBe(200);
      expect(res.headers['x-total-rows']).toBe('1');
      const line = res.text.split('\r\n').filter(Boolean)[1];
      expect(line).toBe(`999001,'=SUM(A1:A9),'+CMD|cmd,'-9+9`);
    } finally {
      await coll.deleteOne({ id: injected.id });
    }
    // dataset is back to its original 300 rows
    const remaining = await coll.countDocuments({});
    expect(remaining).toBe(DATA.length);
  });
});
