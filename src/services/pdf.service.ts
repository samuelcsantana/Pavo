import { PDFDocument } from 'pdf-lib';
import { spawn } from 'child_process';
import fs from 'fs/promises';

export class PdfService {
  
  /**
   * Splits a PDF keeping only the requested range.
   * @param inputPath - The file system path to the source PDF.
   * @param startPage - The starting page number (1-based index).
   * @param endPage - The ending page number (1-based index).
   * @returns A Promise resolving to the new PDF buffer.
   */
  async splitPdf(inputPath: string, startPage: number, endPage: number): Promise<Uint8Array> {
    const existingPdfBytes = await fs.readFile(inputPath);
    
    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    const newPdf = await PDFDocument.create();

    // Adjust index (User: 1-based -> Array: 0-based)
    const start = startPage - 1;
    const end = endPage - 1;
    
    const pageCount = pdfDoc.getPageCount();

    if (isNaN(start) || isNaN(end) || start < 0 || end >= pageCount || start > end) {
      throw new Error(`Invalid page range. The document has ${pageCount} pages.`);
    }

    const pageIndices: number[] = [];
    for (let i = start; i <= end; i++) {
      pageIndices.push(i);
    }
    
    const copiedPages = await newPdf.copyPages(pdfDoc, pageIndices);
    copiedPages.forEach((page) => newPdf.addPage(page));

    return await newPdf.save();
  }

  /**
   * Compresses a PDF using Ghostscript (Linux/WSL native).
   * @param inputPath - Source path.
   * @param outputPath - Destination path.
   * @returns A Promise resolving to the output path string.
   */
  async compressPdf(inputPath: string, outputPath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const args = [
        '-sDEVICE=pdfwrite',
        '-dCompatibilityLevel=1.4',
        '-dPDFSETTINGS=/ebook', 
        '-dNOPAUSE',
        '-dQUIET',
        '-dBATCH',
        `-sOutputFile=${outputPath}`,
        inputPath
      ];

      const child = spawn('gs', args);

      child.on('error', (err) => reject(err));

      child.on('close', (code) => {
        if (code === 0) {
          resolve(outputPath);
        } else {
          reject(new Error(`Ghostscript process exited with code ${code}`));
        }
      });
    });
  }
}