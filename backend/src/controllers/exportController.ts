import { Request, Response } from 'express';
import { exportBodySchema } from '../validation/schemas';
import { generateCsv, previewCsv } from '../services/exportService';

export async function preview(req: Request, res: Response) {
  res.json(await previewCsv(exportBodySchema.parse(req.body)));
}

export async function download(req: Request, res: Response) {
  const { csv, rowCount, filename } = await generateCsv(exportBodySchema.parse(req.body));
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('X-Total-Rows', String(rowCount));
  res.setHeader('Cache-Control', 'no-store');
  res.send(csv);
}
