import { NextFunction, Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import { verifyToken } from '../services/authService';
import { users } from '../models/user';
import { AppError } from '../utils/errors';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUser;
  }
}

/** Requires `Authorization: Bearer <jwt>`; rejects invalid, expired, or logged-out tokens. */
export async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) throw AppError.unauthorized('Missing bearer token');
    const claims = verifyToken(header.slice('Bearer '.length).trim());
    const user = await users().findOne({ _id: new ObjectId(claims.sub) });
    if (!user || user.tokenVersion !== claims.tv) throw AppError.unauthorized('Session is no longer valid');
    req.user = { id: user._id.toHexString(), email: user.email, name: user.name };
    next();
  } catch (err) {
    next(err instanceof AppError ? err : AppError.unauthorized('Invalid or expired token'));
  }
}
