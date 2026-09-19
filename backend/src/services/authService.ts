import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import { ObjectId } from 'mongodb';
import { env } from '../config/env';
import { users } from '../models/user';
import { AppError } from '../utils/errors';

interface Claims {
  sub: string;
  tv: number;
}

// Compared against when the email is unknown so response time does not reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

export function verifyToken(token: string): Claims {
  const decoded = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
  if (typeof decoded === 'string' || typeof decoded.sub !== 'string' || typeof decoded.tv !== 'number') {
    throw AppError.unauthorized('Malformed token');
  }
  if (!ObjectId.isValid(decoded.sub)) throw AppError.unauthorized('Malformed token');
  return { sub: decoded.sub, tv: decoded.tv };
}

export async function login(email: string, password: string) {
  const user = await users().findOne({ email });
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) throw AppError.unauthorized('Invalid email or password');

  const options: SignOptions = { algorithm: 'HS256', expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'] };
  const token = jwt.sign({ tv: user.tokenVersion }, env.JWT_SECRET, { ...options, subject: user._id.toHexString() });
  const { exp } = jwt.decode(token) as { exp: number };
  return {
    token,
    tokenType: 'Bearer' as const,
    expiresAt: new Date(exp * 1000).toISOString(),
    user: { id: user._id.toHexString(), email: user.email, name: user.name },
  };
}

/** Invalidates every token issued to this user by bumping their token version. */
export async function logout(userId: string): Promise<void> {
  await users().updateOne({ _id: new ObjectId(userId) }, { $inc: { tokenVersion: 1 } });
}
