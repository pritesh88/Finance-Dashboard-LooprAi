import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import path from 'node:path';
import { env } from '../config/env';
import { closeDb, connectDb } from '../db/client';
import { ensureIndexes } from '../db/indexes';
import { users } from '../models/user';
import { transactions } from '../models/transaction';
import { importTransactions } from './importTransactions';

async function main() {
  const reset = process.argv.includes('--reset');
  const file = path.resolve(process.cwd(), env.SEED_FILE ?? path.join(__dirname, '../../data/transactions.json'));
  if (!fs.existsSync(file)) throw new Error(`Dataset not found: ${file}`);

  await connectDb();
  await ensureIndexes();

  const result = await importTransactions(JSON.parse(fs.readFileSync(file, 'utf8')), { reset });
  const stored = await transactions().countDocuments();
  console.log(`Transactions: ${result.total} read from ${path.basename(file)} -> ${result.inserted} inserted, ${result.updated} updated, ${result.unchanged} unchanged${reset ? ' (collection reset first)' : ''}. Collection now holds ${stored}.`);

  if (env.SEED_ADMIN_EMAIL && env.SEED_ADMIN_PASSWORD) {
    const email = env.SEED_ADMIN_EMAIL.toLowerCase();
    const passwordHash = await bcrypt.hash(env.SEED_ADMIN_PASSWORD, 12);
    const r = await users().updateOne(
      { email },
      { $set: { name: env.SEED_ADMIN_NAME, passwordHash }, $setOnInsert: { email, tokenVersion: 0, createdAt: new Date() } },
      { upsert: true },
    );
    console.log(`Login user ${email}: ${r.upsertedCount ? 'created' : 'password/name updated'}.`);
  } else {
    console.log('SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD not set: no login user created or changed.');
  }
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(closeDb);
