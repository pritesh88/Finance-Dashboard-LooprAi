import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate } from '../middleware/auth';
import { handle } from '../utils/asyncHandler';
import * as auth from '../controllers/authController';
import * as tx from '../controllers/transactionController';
import * as dash from '../controllers/dashboardController';
import * as exp from '../controllers/exportController';
import { getDb } from '../db/client';
import { env } from '../config/env';

const router = Router();

// Brute-force protection on login (disabled under test so suites can log in freely).
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => env.NODE_ENV === 'test',
  message: { error: { code: 'RATE_LIMITED', message: 'Too many login attempts. Try again in a few minutes.' } },
});

// ---- public --------------------------------------------------------------
router.get('/health', handle(async (_req, res) => {
  await getDb().command({ ping: 1 });
  res.json({ status: 'ok' });
}));
router.post('/auth/login', loginLimiter, handle(auth.login));

// ---- protected (valid JWT required) ---------------------------------------
// `authenticate` is applied per-route (not via router.use) so that a request
// to an unknown /api path falls through to the 404 handler in app.ts instead
// of being intercepted and rejected with 401 by a blanket auth middleware.
router.post('/auth/logout', authenticate, handle(auth.logout));
router.get('/auth/me', authenticate, auth.me);

router.get('/transactions', authenticate, handle(tx.list));
router.get('/transactions/filter-options', authenticate, handle(tx.filterOptions));
router.get('/dashboard', authenticate, handle(dash.dashboard));
router.post('/exports/csv/preview', authenticate, handle(exp.preview));
router.post('/exports/csv', authenticate, handle(exp.download));

export default router;
