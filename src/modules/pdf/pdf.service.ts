import { PDFDocument } from 'pdf-lib';
import pdf from 'pdf-parse';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import { statSync } from 'fs';
import { AppError } from '../../shared/errors/AppError';
import { logger } from '../../shared/infra/logger';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createWorker } from 'tesseract.js';
import * as PImage from 'pureimage';
import { PassThrough } from 'stream';
import path from 'path';

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

        let text = '';
        try {
            const data = await pdf(fileBuffer);
            text = data.text;
        } catch (e: any) {
            logger.warn(`pdf-parse failed: ${e.message}`);
        }

        // If we got a good amount of text, return it.
        // Heuristic: If text length is > 50 chars, we assume it's a text PDF.
        if (text && text.trim().length > 50) {
            return text;
        }

        logger.info('Text extracted is empty or too short. Attempting OCR...');
        const ocrText = await this.performOcr(fileBuffer);

        const finalText = (text + '\n' + ocrText).trim();

        if (!finalText) {
             throw new AppError('Failed to extract text from PDF');
        }

        return finalText;

    } catch (error: any) {
        logger.error(`Extract Text Service Error: ${error.message}`);
        if (error instanceof AppError) throw error;
        throw new AppError('Failed to extract text from PDF');
    }
  }

  private async performOcr(fileBuffer: Buffer): Promise<string> {
      try {
          const loadingTask = pdfjsLib.getDocument({
              data: new Uint8Array(fileBuffer),
              standardFontDataUrl: path.join(process.cwd(), 'node_modules/pdfjs-dist/standard_fonts/'),
          });

          const pdfDocument = await loadingTask.promise;
          const numPages = pdfDocument.numPages;
          let fullText = '';
          const worker = await createWorker('eng');

          for (let i = 1; i <= numPages; i++) {
              const page = await pdfDocument.getPage(i);
              const ops = await page.getOperatorList();

              for (let j = 0; j < ops.fnArray.length; j++) {
                  if (ops.fnArray[j] === pdfjsLib.OPS.paintImageXObject) {
                      const imgName = ops.argsArray[j][0];

                      const img = await new Promise<any>((resolve) => {
                          page.objs.get(imgName, (img: any) => resolve(img));
                      });

                      if (img) {
                          const bitmap = this.convertPdfImageToBitmap(img);
                          if (bitmap) {
                              const pngBuffer = await this.bitmapToPngBuffer(bitmap);
                              const { data } = await worker.recognize(pngBuffer);
                              if (data.text) {
                                  fullText += data.text + '\n';
                              }
                          }
                      }
                  }
              }
          }

          await worker.terminate();
          return fullText;
      } catch (error: any) {
          logger.error(`OCR Error: ${error.message}`);
          return '';
      }
  }

  private convertPdfImageToBitmap(img: any): PImage.Bitmap | null {
      const { width, height, data, kind } = img;
      // kind: 1 = Grayscale, 2 = RGB, 3 = RGBA
      if (!width || !height || !data) return null;

      const bitmap = PImage.make(width, height);
      const target = bitmap.data;
      let targetIdx = 0;
      let srcIdx = 0;

      if (kind === 1) { // Grayscale
          while (srcIdx < data.length) {
              const val = data[srcIdx++];
              target[targetIdx++] = val; // R
              target[targetIdx++] = val; // G
              target[targetIdx++] = val; // B
              target[targetIdx++] = 255; // A
          }
      } else if (kind === 2) { // RGB
          while (srcIdx < data.length) {
              target[targetIdx++] = data[srcIdx++]; // R
              target[targetIdx++] = data[srcIdx++]; // G
              target[targetIdx++] = data[srcIdx++]; // B
              target[targetIdx++] = 255;            // A
          }
      } else if (kind === 3) { // RGBA
           while (srcIdx < data.length) {
              target[targetIdx++] = data[srcIdx++];
              target[targetIdx++] = data[srcIdx++];
              target[targetIdx++] = data[srcIdx++];
              target[targetIdx++] = data[srcIdx++];
          }
      } else {
          return null;
      }
      return bitmap;
  }

  private async bitmapToPngBuffer(bitmap: PImage.Bitmap): Promise<Buffer> {
      const stream = new PassThrough();
      const chunks: Buffer[] = [];
      stream.on('data', (chunk) => chunks.push(chunk));

      await PImage.encodePNGToStream(bitmap, stream);

      return Buffer.concat(chunks);
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
