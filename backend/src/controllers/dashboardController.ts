import { Request, Response } from 'express';
import { filterSchema } from '../validation/schemas';
import { getDashboard } from '../services/dashboardService';

export async function dashboard(req: Request, res: Response) {
  res.json(await getDashboard(filterSchema.parse(req.query)));
}
