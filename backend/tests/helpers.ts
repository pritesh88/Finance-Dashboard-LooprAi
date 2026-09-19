import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import path from 'node:path';
import request from 'supertest';
import { createApp } from '../src/app';
import { closeDb, connectDb } from '../src/db/client';
import { ensureIndexes } from '../src/db/indexes';
import { users } from '../src/models/user';
import { importTransactions } from '../src/scripts/importTransactions';

export interface Tx {
  id: number;
  date: string;
  amount: number;
  category: 'Revenue' | 'Expense';
  status: string;
  user_id: string;
  user_profile: string;
}

/** The provided dataset: the independent source of truth for every expectation. */
export const DATA: Tx[] = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/transactions.json'), 'utf8'));

export const TEST_EMAIL = 'tester@example.com';
export const TEST_PASSWORD = 'Test-Password-1';

export const app = createApp();
export const api = () => request(app);

export async function bootstrap() {
  await connectDb();
  await ensureIndexes();
  await importTransactions(DATA, { reset: true });
  await users().deleteMany({});
  await users().insertOne({
    email: TEST_EMAIL,
    name: 'Test User',
    passwordHash: await bcrypt.hash(TEST_PASSWORD, 4),
    tokenVersion: 0,
    createdAt: new Date(),
  } as never);
}

export async function teardown() {
  await closeDb();
}

export async function loginToken(): Promise<string> {
  const res = await api().post('/api/auth/login').send({ email: TEST_EMAIL, password: TEST_PASSWORD });
  if (res.status !== 200) throw new Error(`login failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.token as string;
}

export const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });
export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
export const sum = (rows: Tx[]) => round2(rows.reduce((s, r) => s + r.amount, 0));
