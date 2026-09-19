import { z } from 'zod';
import { TRANSACTION_FIELDS } from '../models/transaction';

/** Accepts "a,b" or ["a","b"] (query string or JSON body) -> string[] | undefined */
const stringList = z.preprocess(
  (v) => {
    if (v === undefined || v === null || v === '') return undefined;
    const arr = Array.isArray(v) ? v : String(v).split(',');
    const cleaned = arr.map((s) => String(s).trim()).filter(Boolean);
    return cleaned.length ? cleaned : undefined;
  },
  z.array(z.string().max(64)).max(50).optional(),
);

const optionalAmount = z.preprocess(
  (v) => (v === '' || v === undefined || v === null ? undefined : v),
  z.coerce.number({ invalid_type_error: 'Must be a number' }).finite().min(0, 'Must be 0 or greater').optional(),
);

/** YYYY-MM-DD that is a real calendar date. */
const dateOnly = z.preprocess(
  (v) => (v === '' || v === null ? undefined : v),
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
    .refine((s) => {
      const d = new Date(`${s}T00:00:00.000Z`);
      return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(s);
    }, 'Not a valid calendar date')
    .optional(),
);

const filterShape = {
  search: z.preprocess((v) => (v === '' ? undefined : v), z.string().trim().max(100).optional()),
  category: stringList,
  status: stringList,
  user_id: stringList,
  dateFrom: dateOnly,
  dateTo: dateOnly,
  minAmount: optionalAmount,
  maxAmount: optionalAmount,
};

const sortShape = {
  sortBy: z.enum(TRANSACTION_FIELDS).default('date'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
};

type RangeFields = { dateFrom?: string; dateTo?: string; minAmount?: number; maxAmount?: number };

function checkRanges(v: RangeFields, ctx: z.RefinementCtx) {
  if (v.dateFrom && v.dateTo && v.dateFrom > v.dateTo) {
    ctx.addIssue({ code: 'custom', path: ['dateTo'], message: 'End date must be on or after the start date' });
  }
  if (v.minAmount !== undefined && v.maxAmount !== undefined && v.minAmount > v.maxAmount) {
    ctx.addIssue({ code: 'custom', path: ['maxAmount'], message: 'Max amount must be greater than or equal to min amount' });
  }
}

export const filterSchema = z.object(filterShape).superRefine(checkRanges);
export type TransactionFilters = z.infer<typeof filterSchema>;

export const listQuerySchema = z
  .object({
    ...filterShape,
    ...sortShape,
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(10),
  })
  .superRefine(checkRanges);
export type ListQuery = z.infer<typeof listQuerySchema>;

const columnsSchema = z
  .array(z.enum(TRANSACTION_FIELDS), { required_error: 'Select at least one column' })
  .min(1, 'Select at least one column')
  .refine((c) => new Set(c).size === c.length, 'Columns must not repeat');

/** POST body for CSV export + preview. `filters` are only applied when scope = "filtered". */
export const exportBodySchema = z.object({
  columns: columnsSchema,
  scope: z.enum(['filtered', 'all']).default('filtered'),
  filters: z.object(filterShape).superRefine(checkRanges).default({}),
  ...sortShape,
});
export type ExportBody = z.infer<typeof exportBodySchema>;

export const loginSchema = z.object({
  email: z.string({ required_error: 'Email is required' }).trim().toLowerCase().email('Enter a valid email address').max(254),
  password: z.string({ required_error: 'Password is required' }).min(1, 'Password is required').max(200),
});
