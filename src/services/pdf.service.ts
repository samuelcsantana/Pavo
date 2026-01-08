import { PDFDocument } from 'pdf-lib';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import { statSync } from 'fs';

interface CompressOptions {
  /** * If true, removes all images (bitmaps) from the PDF, keeping only text and vectors.
   * Resulting file size is usually extremely small.
   */
  removeImages?: boolean;
}

export class PdfService {
  
  /**
   * Splits a PDF keeping only the requested range of pages.
   * @param inputPath - The file system path to the source PDF.
   * @param startPage - The starting page number (1-based index).
   * @param endPage - The ending page number (1-based index).
   * @returns A Promise resolving to the new PDF buffer.
   */
  async splitPdf(inputPath: string, startPage: number, endPage: number): Promise<Uint8Array> {
    const existingPdfBytes = await fs.readFile(inputPath);
    
    // Load the document
    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    const newPdf = await PDFDocument.create();

    // Adjust index (User input is 1-based, Array is 0-based)
    const start = startPage - 1;
    const end = endPage - 1;
    
    const pageCount = pdfDoc.getPageCount();

    // Basic validation
    if (isNaN(start) || isNaN(end) || start < 0 || end >= pageCount || start > end) {
      throw new Error(`Invalid page range. The document has ${pageCount} pages.`);
    }

    // Generate array of indices to copy
    const pageIndices: number[] = [];
    for (let i = start; i <= end; i++) {
      pageIndices.push(i);
    }
    
    const copiedPages = await newPdf.copyPages(pdfDoc, pageIndices);
    copiedPages.forEach((page) => newPdf.addPage(page));

    return await newPdf.save();
  }

  /**
   * Compresses PDF using Ghostscript with progress tracking and smart size checking.
   * Supports an aggressive mode for images or a "text-only" mode.
   */
  async compressPdf(inputPath: string, outputPath: string, options: CompressOptions = {}): Promise<string> {
    
    // 1. Get Initial File Size
    const initialSize = (statSync(inputPath).size / 1024 / 1024).toFixed(2);
    
    // 2. Load Metadata to count pages (Needed for Progress Bar logic)
    // We use updateMetadata: false to speed up loading for large files
    const fileBuffer = await fs.readFile(inputPath);
    const pdfDoc = await PDFDocument.load(fileBuffer, { updateMetadata: false });
    const totalPages = pdfDoc.getPageCount();

    const modeLabel = options.removeImages ? 'TEXT ONLY (No Images)' : 'AGGRESSIVE (Optimize Images)';
    console.log(`\n[Job Started] 📂 Input: ${initialSize} MB | 📄 Pages: ${totalPages} | ⚙️ Mode: ${modeLabel}`);
    console.log(`[Job Processing] 🔨 Starting Ghostscript...`);

    const startTime = performance.now();

    return new Promise((resolve, reject) => {
      
      // Base Arguments (Common to all modes)
      const args = [
        '-sDEVICE=pdfwrite',
        '-dCompatibilityLevel=1.4',
        '-dPDFSETTINGS=/screen', // 72 dpi base setting
        '-dNOPAUSE',
        '-dBATCH',
        `-sOutputFile=${outputPath}`
      ];

      // --- LOGIC BRANCHING ---
      if (options.removeImages) {
        // OPTION 1: NUCLEAR MODE (Text Only)
        // -dFILTERIMAGE tells Ghostscript to drop all raster images.
        args.push('-dFILTERIMAGE');
      } else {
        // OPTION 2: AGGRESSIVE COMPRESSION
        // Forces downsampling and JPEG encoding even if the image is already small.
        args.push(
          '-dDownsampleColorImages=true',
          '-dColorImageResolution=72',
          '-dGrayImageResolution=72',
          '-dMonoImageResolution=72',
          
          // Force JPEG (DCTEncode) instead of lossless formats
          '-dAutoFilterColorImages=false',
          '-dAutoFilterGrayImages=false',
          '-dColorImageFilter=/DCTEncode',
          '-dGrayImageFilter=/DCTEncode',
          
          // Convert CMYK to RGB (saves ~25% size per pixel)
          '-sColorConversionStrategy=RGB',
          '-sProcessColorModel=DeviceRGB'
        );
      }

      // Add input file at the end
      args.push(inputPath);

      // Spawn process
      const child = spawn('gs', args);

      // Function to parse Ghostscript logs for progress
      const handleOutput = (data: Buffer) => {
        const output = data.toString();
        
        // Ghostscript sends progress like "Page 1", "Page 2" to stderr
        if (output.includes('Page')) {
          const match = output.match(/Page (\d+)/);
          
          if (match && match[1]) {
            const currentPage = parseInt(match[1]);
            // Ensure percentage doesn't exceed 100%
            const percentage = Math.min(Math.round((currentPage / totalPages) * 100), 100);
            
            this.drawProgressBar(percentage, currentPage, totalPages);
          }
        }
      };

      // Listen to BOTH stdout and stderr (Ghostscript primarily uses stderr for logs)
      child.stdout.on('data', handleOutput);
      child.stderr.on('data', handleOutput);

      child.on('error', (err) => {
        console.error(`\n[Job Error] ❌ Failed to start Ghostscript:`, err);
        reject(err);
      });

      child.on('close', async (code) => {
        const endTime = performance.now();
        const durationSeconds = ((endTime - startTime) / 1000).toFixed(2);
        
        // Force 100% bar visualization at the end
        this.drawProgressBar(100, totalPages, totalPages);
        console.log('\n'); // New line after progress bar

        if (code === 0) {
          const finalSizeMb = statSync(outputPath).size / 1024 / 1024;
          const initialSizeMb = parseFloat(initialSize);

          // --- SMART CHECK: Did the file get bigger? ---
          // Logic: If we are NOT removing images (aggressive mode) and file grew, revert.
          // If we ARE removing images, it's virtually impossible to grow, but we keep the check.
          if (finalSizeMb >= initialSizeMb) {
            console.warn(`[Job Warning] ⚠️ Compressed file is larger (${finalSizeMb.toFixed(2)}MB) than original!`);
            console.warn(`[Job Action] ↩️  Reverting to original file.`);
            
            // Overwrite output with the original file
            await fs.copyFile(inputPath, outputPath);
            
            resolve(outputPath);
            return;
          }

          // Success Logic
          const ratio = (finalSizeMb / initialSizeMb) * 100;
          const reduction = (100 - ratio).toFixed(1);

          console.log(`[Job Success] ✅ Finished in ${durationSeconds}s`);
          console.log(`   📉  Size: ${initialSizeMb.toFixed(2)}MB -> ${finalSizeMb.toFixed(2)}MB`);
          console.log(`   💰  Reduction: ${reduction}% saved`);
          
          resolve(outputPath);
        } else {
          console.error(`[Job Error] ❌ Ghostscript exited with code ${code}`);
          reject(new Error(`Ghostscript process exited with code ${code}`));
        }
      });
    });
  }

  /**
   * Helper to draw a cool ASCII progress bar in the terminal.
   * Uses process.stdout.write to overwrite the current line.
   */
  private drawProgressBar(percentage: number, current: number, total: number) {
    const barLength = 30; 
    const filledLength = Math.round((barLength * percentage) / 100);
    const emptyLength = barLength - filledLength;

    const bar = '█'.repeat(filledLength) + '░'.repeat(emptyLength);
    
    process.stdout.write(`\r   Processing: [${bar}] ${percentage}% | Page ${current}/${total}`);
  }
}