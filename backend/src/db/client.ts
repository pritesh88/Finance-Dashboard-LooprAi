import { Db, MongoClient } from 'mongodb';
import { env } from '../config/env';

let client: MongoClient | null = null;
let connecting: Promise<MongoClient> | null = null;

export async function connectDb(): Promise<Db> {
  if (!client) {
    // Share one in-flight connection attempt so concurrent callers (e.g. parallel
    // requests hitting a cold serverless instance) don't open several clients.
    connecting ??= new MongoClient(env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 })
      .connect()
      .finally(() => {
        connecting = null;
      });
    client = await connecting;
  }
  return client.db(env.MONGODB_DB);
}

export function getDb(): Db {
  if (!client) throw new Error('Database not connected. Call connectDb() first.');
  return client.db(env.MONGODB_DB);
}

export async function closeDb(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
  }
}
