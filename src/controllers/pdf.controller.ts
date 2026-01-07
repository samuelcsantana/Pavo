import { Request, Response } from 'express';
import { PdfService } from '../services/pdf.service';
import fs from 'fs/promises';
import path from 'path';

const pdfService = new PdfService();

export class PdfController {

  async split(req: Request, res: Response): Promise<void> {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'No file uploaded.' });
        return;
      }

      // Parse body params to numbers
      const start = parseInt(req.body.start);
      const end = parseInt(req.body.end);
      const inputPath = req.file.path;

      const pdfBuffer = await pdfService.splitPdf(inputPath, start, end);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=split-result.pdf');
      res.send(Buffer.from(pdfBuffer));

      // Cleanup
      await fs.unlink(inputPath).catch(console.error);

    } catch (error: any) {
      console.error('Error splitting PDF:', error);
      res.status(500).json({ error: error.message || 'Internal Server Error' });
      
      if (req.file) await fs.unlink(req.file.path).catch(() => {});
    }
  }

  async compress(req: Request, res: Response): Promise<void> {
    let outputPath = '';
    
    try {
      if (!req.file) {
        res.status(400).json({ error: 'No file uploaded.' });
        return;
      }

      const inputPath = req.file.path;
      outputPath = path.join('uploads', `compressed-${Date.now()}.pdf`);

      await pdfService.compressPdf(inputPath, outputPath);

      res.download(outputPath, 'compressed.pdf', async (err) => {
        try {
          await fs.unlink(inputPath);
          await fs.unlink(outputPath);
        } catch (e) {
          console.error('Error cleaning up files:', e);
        }
      });

    } catch (error: any) {
      console.error('Error compressing PDF:', error);
      res.status(500).json({ error: error.message || 'Internal Server Error' });
      
      if (req.file) await fs.unlink(req.file.path).catch(() => {});
      if (outputPath) await fs.unlink(outputPath).catch(() => {});
    }
  }
}