import { Collection, ObjectId } from 'mongodb';
import { getDb } from '../db/client';

export interface UserDoc {
  _id: ObjectId;
  email: string; // stored lower-cased
  name: string;
  passwordHash: string;
  /** Incremented on logout; a JWT is only valid while its `tv` claim matches. */
  tokenVersion: number;
  createdAt: Date;
}

export const users = (): Collection<UserDoc> => getDb().collection<UserDoc>('users');
