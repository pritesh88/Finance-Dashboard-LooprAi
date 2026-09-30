import { createApp } from './app';
import { connectDb } from './db/client';
import { ensureIndexes } from './db/indexes';

// Serverless entrypoint: there is no startup hook like server.ts's main(), so the
// DB connection is established lazily on the first request and reused while the
// instance stays warm. A failed attempt is not cached, so the next request retries.
let ready: Promise<void> | null = null;
function ensureReady(): Promise<void> {
  ready ??= connectDb()
    .then(() => ensureIndexes())
    .catch((err) => {
      ready = null;
      throw err;
    });
  return ready;
}

const app = createApp({ beforeRequest: ensureReady });
// Vercel sits in front as a proxy; needed for correct client IPs (rate limiting).
app.set('trust proxy', 1);

export default app;
