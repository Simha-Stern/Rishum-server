import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

const databaseUrl = process.env['DATABASE_URL'];

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required. Copy .env.example to .env and update it.');
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/Schemes/index.ts',
  out: './drizzle',
  dbCredentials: {
    url: databaseUrl,
  },
});
