import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { api, bearer, bootstrap, loginToken, teardown, TEST_EMAIL, TEST_PASSWORD } from './helpers';

beforeAll(bootstrap);
afterAll(teardown);

describe('authentication', () => {
  it('health check is public', async () => {
    const res = await api().get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('rejects wrong password and unknown user with the same 401 message', async () => {
    const a = await api().post('/api/auth/login').send({ email: TEST_EMAIL, password: 'wrong-password' });
    const b = await api().post('/api/auth/login').send({ email: 'nobody@example.com', password: 'whatever1' });
    expect(a.status).toBe(401);
    expect(b.status).toBe(401);
    expect(a.body.error.message).toBe(b.body.error.message);
  });

  it('validates the login body (400 with field details)', async () => {
    const res = await api().post('/api/auth/login').send({ email: 'not-an-email' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    const fields = res.body.error.details.map((d: { field: string }) => d.field);
    expect(fields).toEqual(expect.arrayContaining(['email', 'password']));
  });

  it('rejects malformed JSON with 400, not 500', async () => {
    const res = await api().post('/api/auth/login').set('Content-Type', 'application/json').send('{"email": ');
    expect(res.status).toBe(400);
  });

  it('logs in (case-insensitive email) and never returns the password hash', async () => {
    const res = await api().post('/api/auth/login').send({ email: TEST_EMAIL.toUpperCase(), password: TEST_PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.tokenType).toBe('Bearer');
    expect(new Date(res.body.expiresAt).getTime()).toBeGreaterThan(Date.now());
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|\$2[aby]\$/);
  });

  it('protects every data endpoint without a token', async () => {
    const calls = [
      api().get('/api/transactions'),
      api().get('/api/transactions/filter-options'),
      api().get('/api/dashboard'),
      api().post('/api/exports/csv').send({ columns: ['id'] }),
      api().post('/api/exports/csv/preview').send({ columns: ['id'] }),
      api().get('/api/auth/me'),
      api().post('/api/auth/logout'),
    ];
    for (const res of await Promise.all(calls)) expect(res.status).toBe(401);
  });

  it('rejects garbage and tampered tokens', async () => {
    expect((await api().get('/api/auth/me').set(bearer('garbage'))).status).toBe(401);
    const good = await loginToken();
    const tampered = good.slice(0, -3) + (good.endsWith('aaa') ? 'bbb' : 'aaa');
    expect((await api().get('/api/auth/me').set(bearer(tampered))).status).toBe(401);
  });

  it('returns the current user on /me', async () => {
    const res = await api().get('/api/auth/me').set(bearer(await loginToken()));
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(TEST_EMAIL);
  });

  it('logout revokes the token; logging in again works', async () => {
    const token = await loginToken();
    expect((await api().post('/api/auth/logout').set(bearer(token))).status).toBe(204);
    expect((await api().get('/api/transactions').set(bearer(token))).status).toBe(401);
    const fresh = await loginToken();
    expect((await api().get('/api/transactions').set(bearer(fresh))).status).toBe(200);
  });

  it('unknown API routes return a JSON 404', async () => {
    const res = await api().get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
