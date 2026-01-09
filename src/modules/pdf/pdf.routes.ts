import { Router } from 'express';
import multer from 'multer';
import { PdfController } from './pdf.controller';
import { PdfService } from './pdf.service';
import { uploadConfig } from '../../config/upload';

const pdfRoutes = Router();
const upload = multer(uploadConfig);

// Manual Dependency Injection
const pdfService = new PdfService();
const pdfController = new PdfController(pdfService);

/**
 * @swagger
 * tags:
 *   name: PDF
 *   description: PDF manipulation operations
 */

/**
 * @swagger
 * /pdf/split:
 *   post:
 *     summary: Split a PDF file
 *     tags: [PDF]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               start:
 *                 type: string
 *               end:
 *                 type: string
 *     responses:
 *       200:
 *         description: PDF file split successfully
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: Bad request
 */
pdfRoutes.post('/split', upload.single('file'), (req, res, next) => pdfController.split(req, res, next));

/**
 * @swagger
 * /pdf/compress:
 *   post:
 *     summary: Compress a PDF file
 *     tags: [PDF]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               removeImages:
 *                 type: string
 *                 enum: ['true', 'false']
 *     responses:
 *       200:
 *         description: PDF compressed successfully
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 */
pdfRoutes.post('/compress', upload.single('file'), (req, res, next) => pdfController.compress(req, res, next));

/**
 * @swagger
 * /pdf/extract-text:
 *   post:
 *     summary: Extract text from a PDF file
 *     tags: [PDF]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Text extracted successfully
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 */
pdfRoutes.post('/extract-text', upload.single('file'), (req, res, next) => pdfController.extractText(req, res, next));

export { pdfRoutes };
