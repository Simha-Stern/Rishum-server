import type { RequestHandler } from 'express';
import { logger } from '../utils/logger.js';

export const requestLogger: RequestHandler = (request, response, next) => {
  const startedAt = performance.now();

  response.on('finish', () => {
    logger.info('Request completed.', {
      method: request.method,
      path: request.originalUrl,
      statusCode: response.statusCode,
      durationMs: Math.round(performance.now() - startedAt),
      ip: request.ip,
    });
  });

  next();
};
