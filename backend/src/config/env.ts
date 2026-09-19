import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  MONGODB_DB: z.string().min(1).default('finance_dashboard'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('1h'),
  SEED_ADMIN_EMAIL: z.string().email().optional(),
  SEED_ADMIN_PASSWORD: z.string().min(8, 'SEED_ADMIN_PASSWORD must be at least 8 characters').optional(),
  SEED_ADMIN_NAME: z.string().default('Financial Analyst'),
  SEED_FILE: z.string().optional(),
  MAX_EXPORT_ROWS: z.coerce.number().int().positive().default(50_000),
});

export type Env = z.infer<typeof schema>;

function load(): Env {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
    // Fail fast with a readable message; never print secret values.
    throw new Error(`Invalid environment configuration:\n${lines.join('\n')}\nSee backend/.env.example`);
  }
  return parsed.data;
}

export const env: Env = load();
// On Vercel, also allow the deployment's own origin(s) so a stale/missing CORS_ORIGIN can't block the UI.
const vercelOrigins = [process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL, process.env.VERCEL_PROJECT_PRODUCTION_URL]
  .filter((h): h is string => Boolean(h))
  .map((h) => `https://${h}`);

export const corsOrigins = [
  ...new Set([...env.CORS_ORIGIN.split(',').map((s) => s.trim()).filter(Boolean), ...vercelOrigins]),
];
