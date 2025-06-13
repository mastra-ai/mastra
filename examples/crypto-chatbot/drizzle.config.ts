import { env } from 'node:process';
import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

config({
  path: '.env.local',
});

export default defineConfig({
  schema: './db/schema.ts',
  out: './lib/drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: env.POSTGRES_URL!,
  },
});
