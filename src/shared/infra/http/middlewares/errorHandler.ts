import { Request, Response, NextFunction } from 'express';
import { MulterError } from 'multer';
import { AppError } from '../../../errors/AppError';
import { logger } from '../../logger';
import { uploadConfig } from '../../../../config/upload';

export function errorHandler(
  err: Error,
  request: Request,
  response: Response,
  next: NextFunction
) {
  if (err instanceof AppError) {
    return response.status(err.statusCode).json({
      status: 'error',
      message: err.message,
    });
  }

  if (err instanceof MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      const contentLength = request.headers['content-length'];
      const sizeInMb = contentLength ? (parseInt(contentLength) / (1024 * 1024)).toFixed(2) : 'unknown';
      const limitInMb = (uploadConfig.limits.fileSize / (1024 * 1024)).toFixed(2);

      const message = `File too large. Uploaded size: ~${sizeInMb}MB. Max limit: ${limitInMb}MB.`;

      logger.warn(`Upload Error: ${message} | Endpoint: ${request.method} ${request.url}`);

      return response.status(400).json({
        status: 'error',
        message: message,
      });
    }

    return response.status(400).json({
      status: 'error',
      message: err.message,
    });
  }

  logger.error(err);

  return response.status(500).json({
    status: 'error',
    message: 'Internal server error',
  });
}
