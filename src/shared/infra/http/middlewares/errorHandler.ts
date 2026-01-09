import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../../errors/AppError';
import { logger } from '../../logger';

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

  logger.error(err);

  return response.status(500).json({
    status: 'error',
    message: 'Internal server error',
  });
}
