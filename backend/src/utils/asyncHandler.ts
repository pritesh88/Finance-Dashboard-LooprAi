import { NextFunction, Request, RequestHandler, Response } from 'express';

// Express 5 forwards rejected promises to the error handler already; this
// wrapper only keeps controller signatures explicit and typed.
export const handle =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };
