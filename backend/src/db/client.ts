import { Db, MongoClient } from 'mongodb';
import { env } from '../config/env';

let client: MongoClient | null = null;

export async function connectDb(): Promise<Db> {
  if (!client) {
    client = new MongoClient(env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
    await client.connect();
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
