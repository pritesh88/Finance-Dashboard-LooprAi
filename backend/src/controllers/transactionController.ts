import { Request, Response } from 'express';
import { listQuerySchema } from '../validation/schemas';
import * as transactionService from '../services/transactionService';

export async function list(req: Request, res: Response) {
  res.json(await transactionService.listTransactions(listQuerySchema.parse(req.query)));
}

export async function filterOptions(_req: Request, res: Response) {
  res.json(await transactionService.getFilterOptions());
}
