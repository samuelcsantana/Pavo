import { PDFDocument } from 'pdf-lib';
import pdf from 'pdf-parse';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import { statSync } from 'fs';
import { AppError } from '../../shared/errors/AppError';
import { logger } from '../../shared/infra/logger';

interface CompressOptions {
  removeImages?: boolean;
}

export class PdfService {

  async splitPdf(inputPath: string, startPage: number, endPage: number): Promise<Uint8Array> {
    try {
      const existingPdfBytes = await fs.readFile(inputPath);
      const pdfDoc = await PDFDocument.load(existingPdfBytes);
      const newPdf = await PDFDocument.create();

      const start = startPage - 1;
      const end = endPage - 1;

      const pageCount = pdfDoc.getPageCount();

      if (isNaN(start) || isNaN(end) || start < 0 || end >= pageCount || start > end) {
        throw new AppError(`Invalid page range. The document has ${pageCount} pages.`, 400);
      }

      const pageIndices: number[] = [];
      for (let i = start; i <= end; i++) {
        pageIndices.push(i);
      }

      const copiedPages = await newPdf.copyPages(pdfDoc, pageIndices);
      copiedPages.forEach((page) => newPdf.addPage(page));

      return await newPdf.save();
    } catch (error: any) {
       if (error instanceof AppError) throw error;
       logger.error(`Split PDF Service Error: ${error.message}`);
       throw new AppError('Failed to split PDF');
    }
  }

  async extractText(inputPath: string): Promise<string> {
    try {
        const fileBuffer = await fs.readFile(inputPath);
        const data = await pdf(fileBuffer);
        return data.text;
    } catch (error: any) {
        logger.error(`Extract Text Service Error: ${error.message}`);
        throw new AppError('Failed to extract text from PDF');
    }
  }

  async compressPdf(inputPath: string, outputPath: string, options: CompressOptions = {}): Promise<string> {
    const initialSize = (statSync(inputPath).size / 1024 / 1024).toFixed(2);

    // Load metadata efficiently
    const fileBuffer = await fs.readFile(inputPath);
    const pdfDoc = await PDFDocument.load(fileBuffer, { updateMetadata: false });
    const totalPages = pdfDoc.getPageCount();

    const modeLabel = options.removeImages ? 'TEXT ONLY (No Images)' : 'AGGRESSIVE (Optimize Images)';
    logger.info(`[Job Started] 📂 Input: ${initialSize} MB | 📄 Pages: ${totalPages} | ⚙️ Mode: ${modeLabel}`);

    const startTime = performance.now();

    return new Promise((resolve, reject) => {

      const args = [
        '-sDEVICE=pdfwrite',
        '-dCompatibilityLevel=1.4',
        '-dPDFSETTINGS=/screen',
        '-dNOPAUSE',
        '-dBATCH',
        `-sOutputFile=${outputPath}`
      ];

      if (options.removeImages) {
        args.push('-dFILTERIMAGE');
      } else {
        args.push(
          '-dDownsampleColorImages=true',
          '-dColorImageResolution=72',
          '-dGrayImageResolution=72',
          '-dMonoImageResolution=72',
          '-dAutoFilterColorImages=false',
          '-dAutoFilterGrayImages=false',
          '-dColorImageFilter=/DCTEncode',
          '-dGrayImageFilter=/DCTEncode',
          '-sColorConversionStrategy=RGB',
          '-sProcessColorModel=DeviceRGB'
        );
      }

      args.push(inputPath);

      const child = spawn('gs', args);

      child.on('error', (err) => {
        logger.error(`[Job Error] ❌ Failed to start Ghostscript: ${err.message}`);
        reject(new AppError('Failed to start compression process', 500));
      });

      child.on('close', async (code) => {
        const endTime = performance.now();
        const durationSeconds = ((endTime - startTime) / 1000).toFixed(2);

        if (code === 0) {
          const finalSizeMb = statSync(outputPath).size / 1024 / 1024;
          const initialSizeMb = parseFloat(initialSize);

          if (finalSizeMb >= initialSizeMb) {
            logger.warn(`[Job Warning] ⚠️ Compressed file is larger (${finalSizeMb.toFixed(2)}MB) than original! Reverting.`);
            await fs.copyFile(inputPath, outputPath);
            resolve(outputPath);
            return;
          }

          logger.info(`[Job Success] ✅ Finished in ${durationSeconds}s. Size: ${initialSizeMb.toFixed(2)}MB -> ${finalSizeMb.toFixed(2)}MB`);
          resolve(outputPath);
        } else {
          logger.error(`[Job Error] ❌ Ghostscript exited with code ${code}`);
          reject(new AppError('Compression process failed', 500));
        }
      });
    });
  }
}
