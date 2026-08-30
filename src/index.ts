import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import { pool } from './db/index.js';
import { router } from './router.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { notFound } from './middlewares/notFound.js';
import { requestLogger } from './middlewares/requestLogger.js';
import { logger } from './utils/logger.js';

const app = express();
const port = Number(process.env['PORT'] ?? 3001);

app.use(cors({ origin: process.env['CLIENT_ORIGIN'] ?? 'http://localhost:4200' }));
app.use(express.json());
app.use(requestLogger);

app.use('/api', router);
app.get('/health', (_request, response) => response.json({ status: 'ok' }));
app.get('/ping', (_request, response) => response.json({ status: 'pong' }));
app.use(notFound);

app.use(errorHandler);

const server = app.listen(port, () => {
  logger.info(`Rishum server is running at http://localhost:${port}`);
});

const shutdown = async () => {
  logger.info('Shutting down Rishum server.');
  await pool.end();
  server.close();
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
