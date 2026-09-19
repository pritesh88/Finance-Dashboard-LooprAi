# Financial Analytics Dashboard

A full-stack dashboard for exploring a transactions dataset: JWT-authenticated login, KPI cards, charts
(monthly revenue vs. expenses, category breakdown, per-user split), a searchable/filterable/sortable/paginated
transaction table, and a configurable CSV export.

Stack: **React 19 + TypeScript + Vite + MUI + Recharts** (frontend), **Node + TypeScript + Express 5 + MongoDB
(native driver) + JWT** (backend).

## Contents

- [Quick start](#quick-start)
- [Project structure](#project-structure)
- [Environment variables](#environment-variables)
- [Running in development](#running-in-development)
- [Single-server (production-style) mode](#single-server-production-style-mode)
- [API reference](#api-reference)
- [Architecture decisions](#architecture-decisions)
- [Assumptions & limitations](#assumptions--limitations)
- [Testing](#testing)

## Quick start

```bash
# 1. Database — either Docker...
docker compose up -d
# ...or point MONGODB_URI in backend/.env at any MongoDB 6/7 instance (Atlas works too).

# 2. Backend
cd backend
cp .env.example .env        # edit JWT_SECRET / SEED_ADMIN_* as you like
npm install
npm run seed                # loads data/transactions.json + creates the login user
npm run dev                 # http://localhost:4000

# 3. Frontend (new terminal)
cd frontend
cp .env.example .env
npm install
npm run dev                 # http://localhost:5173 (proxies /api -> :4000)
```

Sign in with the seed admin credentials from `backend/.env`
(`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`, e.g. `analyst@example.com` / `pritesh@6822`).

## Project structure

```
backend/
  src/
    config/        env parsing & validation (zod, fail-fast)
    db/            Mongo client + index creation
    models/        typed collection accessors, field metadata
    validation/    zod schemas (query params, request bodies)
    services/      business logic (filters, transactions, dashboard, export, auth)
    controllers/    thin HTTP glue over services
    middleware/    auth (JWT) + centralized error handling
    routes/        route table
    scripts/       seed.ts, importTransactions.ts
  tests/           vitest + supertest, expectations computed from data/transactions.json
  data/transactions.json   the dataset (source of truth)
frontend/
  src/
    api/           fetch wrapper, typed endpoint functions, shared types
    context/       AuthContext, AlertContext (the "alert chip" stack)
    components/    FilterBar, KpiCards, TransactionsTable, ExportDialog, charts/
    pages/         LoginPage, DashboardPage
    utils/         currency/date formatting, avatar initials/colors
docs/assignment.pdf   original spec
docker-compose.yml     local MongoDB
```

## Environment variables

Both apps ship `.env.example`; copy to `.env` and adjust.

**`backend/.env`**

| Variable | Purpose |
|---|---|
| `PORT` | API port (default 4000) |
| `CORS_ORIGIN` | allowed browser origin(s), comma-separated |
| `MONGODB_URI`, `MONGODB_DB` | database connection |
| `JWT_SECRET` | **required**, ≥32 chars | 
| `JWT_EXPIRES_IN` | token lifetime (e.g. `1h`) |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` / `SEED_ADMIN_NAME` | the login user `npm run seed` creates (the dataset itself has no accounts) |
| `MAX_EXPORT_ROWS` | safety cap on a single CSV export |

**`frontend/.env`**

| Variable | Purpose |
|---|---|
| `VITE_CURRENCY` | ISO currency code used to format every amount (default `USD`) |

## Running in development

- Backend: `npm run dev` (tsx watch), `npm run build && npm start` for a compiled run, `npm run typecheck`.
- Frontend: `npm run dev` (Vite, proxies `/api` to `http://localhost:4000`), `npm run build` (runs `tsc -b` then
  `vite build`), `npm run preview`.
- Database setup / seed / import: `npm run seed` (idempotent — diffs against what's already stored and only
  writes what changed) and `npm run seed:reset` (wipes transactions first). `src/scripts/importTransactions.ts`
  is the reusable import function seed.ts calls; it validates every record before writing anything.

## Single-server (production-style) mode

`backend/src/app.ts` serves `frontend/dist` (and falls back to `index.html` for client-side routes) when that
directory exists, so a full production-style run is:

```bash
cd frontend && npm run build      # produces frontend/dist
cd ../backend && npm run build && npm start
# open http://localhost:4000 — API and UI on one origin, no CORS/proxy needed
```

## API reference

All routes are under `/api`. Every route except `/health` and `POST /auth/login` requires
`Authorization: Bearer <jwt>`.

| Method & path | Notes |
|---|---|
| `GET /health` | liveness + DB ping |
| `POST /auth/login` | `{email, password}` → `{token, tokenType, expiresAt, user}` |
| `POST /auth/logout` | revokes the token (bumps `tokenVersion`) → 204 |
| `GET /auth/me` | current user |
| `GET /transactions` | `search, category, status, user_id` (comma-separated), `dateFrom, dateTo` (`YYYY-MM-DD`), `minAmount, maxAmount`, `sortBy` (`id\|date\|amount\|category\|status\|user_id\|user_profile`), `sortOrder` (`asc\|desc`), `page, pageSize` (≤100) → `{data, pagination}` |
| `GET /transactions/filter-options` | distinct categories/statuses/user ids + date & amount ranges, for building filter controls |
| `GET /dashboard` | same filters as above → `{summary, trend[], categories[], statuses[], users[]}` |
| `POST /exports/csv/preview` | `{columns[], scope: "filtered"\|"all", filters, sortBy, sortOrder}` → first 5 rows + `totalRows` |
| `POST /exports/csv` | same body → CSV file (`Content-Disposition`, `X-Total-Rows` header) |

Errors are `{ error: { code, message, details? } }`, with the HTTP status matching (`400` validation,
`401` auth, `404` not found, `413` export too large, `500` unexpected).

## Architecture decisions

- **Layered backend**: `controller → service → model`, with `filterBuilder.ts` building the one Mongo filter
  shared by the transaction list, the dashboard, and CSV export, so all three always describe the same rows.
- **`month` is the only derived field** stored on each transaction (`"YYYY-MM"`, UTC), computed once at
  import time, so the dashboard's monthly trend can use a plain `$match + $group` instead of date-formatting
  aggregation operators.
- **Dashboard aggregation runs two single-accumulator `$group` pipelines per dimension instead of one
  combined pipeline**, merged in application code (`dashboardService.ts`). A single `$group` with both a
  `$sum` and a `$count` accumulator is the more natural way to write this and is what real MongoDB is
  expected to run — this project's sandbox uses a Mongo-compatible database (see *Environment notes* below)
  whose aggregation engine silently returns `0` for every accumulator after the first one in the same
  `$group`, and for a constant `$sum` (e.g. `$sum: 1`) specifically. Splitting into two single-accumulator
  pipelines side-steps both issues and is a portable, harmless change — it still is pure `$match` + `$group`
  and produces identical results against a real MongoDB server, just as two round trips instead of one.
- **Auth**: JWT in the `Authorization` header (not a cookie) — see the localStorage trade-off note below.
  `authenticate` is applied per-route rather than via a blanket `router.use(authenticate)`, so a request to an
  unmatched `/api` path 404s instead of being intercepted and rejected with a generic 401.
- **Search** is a single case-insensitive substring match across `category`/`status`/`user_id`, plus: a
  purely-numeric term also matches `id` and `amount` exactly, and a `YYYY`, `YYYY-MM`, or `YYYY-MM-DD` term
  matches transactions dated in that UTC period. This covers the sample searches in the assignment
  (`"paid"`, `"user_003"`, `"2024-03"`, `"42"`, `"1500"`) without a separate per-field search UI.
- **Validation** is centralized in `zod` schemas on the backend (single source of truth for what's a valid
  filter/query/body) and re-checked lightly on the frontend for instant feedback; server 400s always surface
  through the "alert chip" stack.
- **CSV export**: `id`/`date`/`amount`/`category`/`status`/`user_id`/`user_profile` cells are formatted with
  the exact same functions used for the live preview, so what you preview is what you download. Any text
  cell starting with `= + - @` or a tab/CR is prefixed with `'` (CSV/formula-injection neutralization).
- **Frontend data flow**: `DashboardPage` owns filters/sort/pagination state and fans it out to `FilterBar`,
  `KpiCards`, the three chart components, and `TransactionsTable`; filters changing resets to page 1 and
  refetches both `/dashboard` and `/transactions` so KPIs, charts and the table always agree.
- **Chart palette**: the same two colors mean "Revenue" and "Expense" everywhere — KPI cards, all three
  charts, table chips — picked from a colorblind-safe, contrast-validated categorical pair (see
  `frontend/src/theme.ts`).

## Assumptions & limitations

- **No login accounts exist in the dataset.** `npm run seed` creates exactly one user from
  `SEED_ADMIN_*`; there's no self-service signup (out of scope for the assignment).
- **Currency**: the dataset has no currency field. USD is assumed and is configurable via
  `VITE_CURRENCY` — it only changes formatting (`Intl.NumberFormat`), not the underlying numbers.
- **Dates are UTC everywhere** — stored as UTC in Mongo, filtered as UTC day boundaries, and displayed as
  UTC in the UI (labelled where ambiguous) — since the dataset's timestamps are UTC ISO strings with no
  timezone attached to users.
- **`user_profile`** is the same placeholder URL for all 300 rows (a thispersondoesnotexist.com link), so the
  UI never renders it as an image; users are shown as colored initials avatars instead.
- **Only two categories exist** (`Revenue`/`Expense`), so the "category breakdown" chart is necessarily a
  two-slice donut rather than a richer breakdown.
- **Amounts** are stored as doubles (as in the source JSON); every sum shown is rounded to cents for display,
  matching how the dataset's own totals were verified.
- **Auth token storage**: the JWT lives in `localStorage`, not an httpOnly cookie. This is the common
  trade-off for a single-page app calling its own API from the browser — simpler CORS/CSRF story, but
  vulnerable to token theft via XSS if the app were ever compromised by injected script. Given the scope
  (an internal analytics tool, no user-generated content rendered as HTML), this was judged an acceptable
  trade-off; a cookie + CSRF-token scheme would be the next step for a public-facing app.
- **Logout revokes every session for that user** (`tokenVersion` is bumped), not just the current token —
  there's no per-device session list, so "sign out everywhere" is the only option.
- **CSV export cap**: `MAX_EXPORT_ROWS` (default 50,000) guards against an unbounded export; requests over
  the cap get a `413` asking the user to narrow their filters.
- **No code-splitting**: the frontend bundle is a single ~290KB gzipped chunk. Given the scope (one route, no
  client-side router) this was judged not worth the added complexity — `vite build` prints a chunk-size
  warning that's safe to ignore here.
- A `Figma` link mentioned in the original brief could not be opened in this environment (no network access
  to Figma); the frontend was built to the written spec and the dataset only.

## Testing

**Backend** (`cd backend && npm test`, vitest + supertest, 46 tests): authentication (login validation, wrong
password, tampered/expired tokens, logout revocation, the `/api/nope` → 404 regression test for the bug fixed
in this handoff), transaction listing (default sort, full-pagination coverage of all 300 ids, every sortable
column asc/desc, every filter and combinations, the five sample searches from the assignment, `400`s for
invalid date ranges / oversized `pageSize` / unknown `sortBy`), filter-options, dashboard (totals match the
verified dataset facts, 12-month trend sums back to the totals, category/status/per-user breakdowns, filtered
and empty-result cases), and CSV export (header row, column order, CRLF line endings, row counts, `scope`
`filtered` vs `all`, empty-columns `400`, and formula-injection neutralization verified by inserting a
throwaway transaction with `=`/`+`/`-`-prefixed fields, exporting it, and deleting it again). Every expectation
is computed independently from `data/transactions.json` in `tests/helpers.ts`, not hand-typed numbers.

Every test run against MongoDB. Set `MONGODB_URI`/`JWT_SECRET` in `backend/.env` before running
`npm test` (a dedicated `finance_dashboard_test` database is used so tests never touch real data).

**Frontend** (`cd frontend && npm test`, vitest + @testing-library/react + jsdom, 10 tests): currency/date/
percent/initials formatting utilities, login form validation (required fields, invalid email — without ever
calling the API), and the alert-chip stack (push, render, dismiss).

**Manually verified** (both dev mode and the single-server production build): sign-in/out, session-expiry
handling (a 401 on any authenticated call logs the user out with an "session expired" alert chip), filtering/
searching/sorting/paginating the table, all three charts and KPI cards updating together with the filters, the
export dialog's live preview and CSV download, loading/empty/error states, keyboard focus visibility, and the
responsive layout at a mobile viewport width.

## Environment notes (this sandbox only)

This project was developed and verified in a network-restricted sandbox with no access to a real `mongod`
binary. A MongoDB-wire-compatible stand-in — [FerretDB](https://www.ferretdb.io/) 1.24 (PostgreSQL-backed) —
was used instead, reachable at the same `mongodb://127.0.0.1:27017` URI a real MongoDB would use. **On a normal
machine with MongoDB installed, none of this section applies** — just run `docker compose up -d` (or point
`MONGODB_URI` at any MongoDB 6/7) as described above.

FerretDB 1.24's aggregation engine has two limitations that a real MongoDB does not: a `$group` stage only
correctly computes its *first* accumulator field (every accumulator after it silently returns `0`), and a
constant `$sum` expression (e.g. `$sum: 1`) inside `$group` also returns `0` even as the sole accumulator. Both
are worked around in `backend/src/services/dashboardService.ts` by running two single-accumulator `$group`
pipelines per dimension instead of one combined pipeline (see *Architecture decisions* above) — a change that
produces identical output against real MongoDB, just as two round trips instead of one, so nothing needs to be
reverted to run this project against a real database.
