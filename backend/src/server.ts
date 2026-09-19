import { createApp } from './app';
import { env } from './config/env';
import { closeDb, connectDb } from './db/client';
import { ensureIndexes } from './db/indexes';

async function main() {
  await connectDb();
  await ensureIndexes();
  const app = createApp();
  const server = app.listen(env.PORT, () => {
    console.log(`API listening on http://localhost:${env.PORT}  (db: ${env.MONGODB_DB})`);
  });

  const shutdown = (signal: string) => {
    console.log(`${signal} received, shutting down`);
    server.close(async () => {
      await closeDb();
      process.exit(0);
    });
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('Failed to start server:', err instanceof Error ? err.message : err);
  process.exit(1);
});
