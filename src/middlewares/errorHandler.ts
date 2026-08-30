import type { ErrorRequestHandler } from 'express';
import { HttpError } from '../lib/http-error.js';
import { logger } from '../utils/logger.js';

export const errorHandler: ErrorRequestHandler = (
    error: unknown,
    request,
    response,
    next,
) => {
    if (response.headersSent) return next(error);

    if (error instanceof HttpError) {
        logger.warn('Request failed.', {
            method: request.method,
            path: request.originalUrl,
            statusCode: error.statusCode,
            message: error.message,
        });
        response.status(error.statusCode).json({ message: error.message });
        return;
    }

    logger.error('Unhandled request error.', {
        method: request.method,
        path: request.originalUrl,
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
    });
    response.status(500).json({ message: 'Internal server error.' });
};
