import { Collection } from 'mongodb';
import { getDb } from '../db/client';

/**
 * Field names mirror transactions.json exactly (id, date, amount, category,
 * status, user_id, user_profile). `month` is the only derived field: a
 * "YYYY-MM" (UTC) key computed from `date` at import time so monthly analytics
 * can use a plain, indexable $group instead of date-formatting operators.
 */
export const CATEGORIES = ['Revenue', 'Expense'] as const;
export type Category = (typeof CATEGORIES)[number];

export interface TransactionDoc {
  id: number;
  date: Date;
  amount: number;
  category: Category;
  status: string;
  user_id: string;
  user_profile: string;
  month: string;
}

/** Columns that can be sorted / exported, in the dataset's natural order. */
export const TRANSACTION_FIELDS = ['id', 'date', 'amount', 'category', 'status', 'user_id', 'user_profile'] as const;
export type TransactionField = (typeof TRANSACTION_FIELDS)[number];

export const FIELD_LABELS: Record<TransactionField, string> = {
  id: 'ID',
  date: 'Date',
  amount: 'Amount',
  category: 'Category',
  status: 'Status',
  user_id: 'User ID',
  user_profile: 'User Profile',
};

export const transactions = (): Collection<TransactionDoc> => getDb().collection<TransactionDoc>('transactions');

export function monthKey(d: Date): string {
  return d.toISOString().slice(0, 7);
}
