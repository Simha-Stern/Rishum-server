import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import { pool } from './db/index.js';
import { router } from './router.js';

const app = express();
const port = Number(process.env['PORT'] ?? 3000);

app.use(cors({ origin: process.env['CLIENT_ORIGIN'] ?? 'http://localhost:4200' }));
app.use(express.json());
app.use('/api', router);

app.get('/health', (_request, response) => response.json({ status: 'ok' }));

app.use((_request, response) => response.status(404).json({ message: 'Route not found.' }));

app.use(
  (
    error: unknown,
    _request: express.Request,
    response: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error(error);
    response.status(500).json({ message: 'Internal server error.' });
  },
);

const server = app.listen(port, () => {
  console.log(`Rishum server is running at http://localhost:${port}`);
});

const shutdown = async () => {
  await pool.end();
  server.close();
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
