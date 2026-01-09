
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PdfService } from '../pdf.service';
import fs from 'fs/promises';
import pdf from 'pdf-parse';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createWorker } from 'tesseract.js';
import * as PImage from 'pureimage';

// Mocks
vi.mock('fs/promises');
vi.mock('pdf-parse');
vi.mock('pdfjs-dist/legacy/build/pdf.mjs');
vi.mock('tesseract.js');
vi.mock('pureimage');

describe('PdfService', () => {
    let service: PdfService;

    beforeEach(() => {
        service = new PdfService();
        vi.resetAllMocks();
    });

    describe('extractText', () => {
        it('should return text directly from pdf-parse if it finds enough text', async () => {
            (fs.readFile as any).mockResolvedValue(Buffer.from('dummy'));
            (pdf as any).mockResolvedValue({ text: 'This is a long enough text to satisfy the condition of having more than 50 characters..............' });

            const result = await service.extractText('path/to/pdf');
            expect(result).toContain('This is a long enough text');
            expect(pdf).toHaveBeenCalled();
            // Should NOT call OCR (pdfjsLib.getDocument)
            expect(pdfjsLib.getDocument).not.toHaveBeenCalled();
        });

        it('should fallback to OCR if pdf-parse returns empty text', async () => {
            (fs.readFile as any).mockResolvedValue(Buffer.from('dummy'));
            (pdf as any).mockResolvedValue({ text: ' ' }); // Empty text

            // Mock pdfjsLib
            const mockGetPage = vi.fn();
            const mockPdfDocument = {
                numPages: 1,
                getPage: mockGetPage
            };
            const mockLoadingTask = {
                promise: Promise.resolve(mockPdfDocument)
            };
            (pdfjsLib.getDocument as any).mockReturnValue(mockLoadingTask);
            (pdfjsLib.OPS as any) = { paintImageXObject: 123 };

            // Mock Page ops
            const mockOps = {
                fnArray: [123], // Matches OPS.paintImageXObject
                argsArray: [['img1']]
            };
            mockGetPage.mockResolvedValue({
                getOperatorList: vi.fn().mockResolvedValue(mockOps),
                objs: {
                    get: vi.fn((name, cb) => cb({ width: 100, height: 100, data: new Uint8Array(100*100*3), kind: 2 })) // RGB image
                }
            });

            // Mock PImage
            const mockBitmap = { data: new Uint8Array(100*100*4) };
            (PImage.make as any).mockReturnValue(mockBitmap);
            (PImage.encodePNGToStream as any).mockResolvedValue(undefined);

            // Mock Tesseract
            const mockWorker = {
                recognize: vi.fn().mockResolvedValue({ data: { text: 'OCR Result' } }),
                terminate: vi.fn().mockResolvedValue(undefined)
            };
            (createWorker as any).mockResolvedValue(mockWorker);

            const result = await service.extractText('path/to/pdf');

            expect(result).toContain('OCR Result');
            expect(pdfjsLib.getDocument).toHaveBeenCalled();
            expect(mockWorker.recognize).toHaveBeenCalled();
        });
    });
});
