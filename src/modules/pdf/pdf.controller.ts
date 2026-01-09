import { Request, Response, NextFunction } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { PdfService } from './pdf.service';
import { splitPdfSchema, compressPdfSchema } from './dtos/pdf.dto';
import { AppError } from '../../shared/errors/AppError';

export class PdfController {

  constructor(private pdfService: PdfService) {}

  async split(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) {
        throw new AppError('No file uploaded.');
      }

      const inputPath = req.file.path;
      const validation = splitPdfSchema.safeParse(req.body);

      if (!validation.success) {
         throw new AppError(validation.error.issues.map(e => e.message).join(', '), 400);
      }

      const { start, end } = validation.data;

      const pdfBytes = await this.pdfService.splitPdf(inputPath, start, end);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=split-result.pdf');
      res.send(Buffer.from(pdfBytes));

      await fs.unlink(inputPath);
    } catch (error) {
      if (req.file) await fs.unlink(req.file.path).catch(() => {});
      next(error);
    }
  }

  async extractText(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) {
        throw new AppError('No file uploaded.');
      }

      const inputPath = req.file.path;
      const text = await this.pdfService.extractText(inputPath);

      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Content-Disposition', 'attachment; filename=extracted-text.txt');
      res.send(text);

      await fs.unlink(inputPath);
    } catch (error) {
       if (req.file) await fs.unlink(req.file.path).catch(() => {});
       next(error);
    }
  }

  async compress(req: Request, res: Response, next: NextFunction): Promise<void> {
    let outputPath = '';
    try {
      if (!req.file) {
        throw new AppError('No file uploaded.');
      }

      const inputPath = req.file.path;
      outputPath = path.join('uploads', `compressed-${Date.now()}.pdf`);

      const validation = compressPdfSchema.safeParse(req.body);
      const removeImages = validation.success ? validation.data.removeImages : false;

      await this.pdfService.compressPdf(inputPath, outputPath, { removeImages });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=compressed.pdf');

      res.download(outputPath, 'compressed.pdf', async (err) => {
        if (err) {
            // Cannot pass to next(err) efficiently if headers sent, but we log it.
        }
        try {
          await fs.unlink(inputPath);
          await fs.unlink(outputPath);
        } catch (cleanupError) {}
      });

    } catch (error) {
      if (req.file) await fs.unlink(req.file.path).catch(() => {});
      if (outputPath) await fs.unlink(outputPath).catch(() => {});
      next(error);
    }
  }
}
