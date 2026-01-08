import { Request, Response } from 'express';

import fs from 'fs/promises';
import path from 'path';
import { PdfService } from '../services/pdf.service';

const pdfService = new PdfService();

export class PdfController {

  /**
   * Handles PDF Splitting
   * Extracts a specific range of pages (start to end) from the uploaded PDF.
   */
  async split(req: Request, res: Response): Promise<void> {
    try {
      // 1. Validation: Check if file exists
      if (!req.file) {
        res.status(400).json({ error: 'No file uploaded.' });
        return;
      }

      const inputPath = req.file.path;
      // Convert FormData strings to numbers
      const { start, end } = req.body;

      // 2. Process: Call the service
      const pdfBytes = await pdfService.splitPdf(
        inputPath,
        parseInt(start),
        parseInt(end)
      );

      // 3. Response: Send the binary PDF buffer
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=split-result.pdf');
      res.send(Buffer.from(pdfBytes));

      // 4. Cleanup: Delete the uploaded temp file immediately
      await fs.unlink(inputPath);

    } catch (error: any) {
      console.error('Split Error:', error);
      res.status(500).json({ error: error.message || 'Internal Server Error' });
      
      // Cleanup on error: ensure we don't leave junk files
      if (req.file) await fs.unlink(req.file.path).catch(() => {});
    }
  }

  /**
   * Handles PDF Compression
   * Optimizes file size using Ghostscript.
   * Supports 'removeImages' option for maximum size reduction.
   */
  async compress(req: Request, res: Response): Promise<void> {
    let outputPath = '';

    try {
      // 1. Validation
      if (!req.file) {
        res.status(400).json({ error: 'No file uploaded.' });
        return;
      }

      const inputPath = req.file.path;
      
      // Generate a unique output path in the 'uploads' folder
      outputPath = path.join('uploads', `compressed-${Date.now()}.pdf`);

      // 2. Parse Options
      // FormData sends booleans as strings ("true" or "false"), so we compare strict string
      const removeImages = req.body.removeImages === 'true';

      // 3. Process: Call the service
      // This is the heavy lifting part (Ghostscript)
      await pdfService.compressPdf(inputPath, outputPath, { removeImages });

      // 4. Response: Set headers explicitly to avoid "strange file" issues
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=compressed.pdf');

      // Use res.download to stream the file to the client
      res.download(outputPath, 'compressed.pdf', async (err) => {
        if (err) {
          console.error('Download Error:', err);
          // Note: Cannot send error response here because headers are already sent
        }

        // 5. Final Cleanup: Delete BOTH input and output files after success or error
        try {
          await fs.unlink(inputPath);  // Delete original upload
          await fs.unlink(outputPath); // Delete the compressed result
          // console.log('🧹 Cleanup: Temp files deleted.');
        } catch (cleanupError) {
          console.error('Cleanup Error:', cleanupError);
        }
      });

    } catch (error: any) {
      console.error('Compress Error:', error);
      res.status(500).json({ error: error.message || 'Internal Server Error' });

      // Cleanup on critical logic error
      if (req.file) await fs.unlink(req.file.path).catch(() => {});
      if (outputPath) await fs.unlink(outputPath).catch(() => {});
    }
  }
}