import express from "express";
import { createApp } from "./app";
import { connectDb } from "./db/client";
import { errorHandler } from "./middleware/errorHandler";

// Serverless entrypoint. Unlike server.ts there is no long-lived boot step, so the
// Mongo connection is opened lazily per invocation (connectDb caches the client, so
// warm invocations reuse it).
const handler = express();

handler.use(async (_req, _res, next) => {
  try {
    await connectDb();
    next();
  } catch (err) {
    next(err);
  }
});

handler.use(createApp());
handler.use(errorHandler);

export default handler;
