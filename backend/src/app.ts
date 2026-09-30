import cors, { CorsOptions } from 'cors';
import express, { Request } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import helmet from 'helmet';
import { corsOrigins } from './config/env';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import routes from './routes';

// Deployment URLs Vercel injects (hostnames without scheme); always allowed.
const vercelOrigins = [process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL, process.env.VERCEL_PROJECT_PRODUCTION_URL]
  .filter((h): h is string => Boolean(h))
  .map((h) => `https://${h}`);

function isAllowedOrigin(origin: string | undefined, req: Request): boolean {
  if (!origin) return true; // non-browser clients (curl, server-to-server)
  if (corsOrigins.includes('*') || corsOrigins.includes(origin) || vercelOrigins.includes(origin)) return true;
  // Same-origin requests (frontend and API served from one domain, as on Vercel).
  const host = req.get('x-forwarded-host') ?? req.get('host');
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export interface AppOptions {
  /** Runs before every /api request; used by the serverless entrypoint to connect to the DB lazily. */
  beforeRequest?: () => Promise<void>;
}

export function createApp(options: AppOptions = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(
    cors((req, cb) => {
      const options: CorsOptions = {
        origin: isAllowedOrigin(req.headers.origin, req as Request),
        exposedHeaders: ['Content-Disposition', 'X-Total-Rows'],
      };
      cb(null, options);
    }),
  );
  app.use(express.json({ limit: '100kb' }));

  const { beforeRequest } = options;
  if (beforeRequest) {
    app.use('/api', (_req, _res, next) => {
      beforeRequest().then(() => next(), next);
    });
  }

  app.use('/api', routes);
  app.use('/api', notFoundHandler);

  // Optional: serve the built frontend from the same origin (production-style single server).
  const dist = path.resolve(__dirname, '../../frontend/dist');
  if (fs.existsSync(path.join(dist, 'index.html'))) {
    app.use(express.static(dist));
    app.get('/{*splat}', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  }

  app.use(errorHandler);
  return app;
}
