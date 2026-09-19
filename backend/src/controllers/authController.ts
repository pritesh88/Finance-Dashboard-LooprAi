import { Request, Response } from 'express';
import { loginSchema } from '../validation/schemas';
import * as authService from '../services/authService';

export async function login(req: Request, res: Response) {
  const { email, password } = loginSchema.parse(req.body);
  res.json(await authService.login(email, password));
}

export async function logout(req: Request, res: Response) {
  await authService.logout(req.user!.id);
  res.status(204).end();
}

export function me(req: Request, res: Response) {
  res.json({ user: req.user });
}
