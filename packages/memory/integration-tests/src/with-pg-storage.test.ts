import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { $ } from 'execa';
import { afterAll, beforeAll, describe } from 'vitest';
import { getPgStorageTests } from './shared/with-pg-storage';

// Ensure environment variables are set
if (!process.env.DB_URL) {
  console.warn('DB_URL not set, using default local PostgreSQL connection');
}

const __dirname = fileURLToPath(import.meta.url);
const connectionString = process.env.DB_URL || 'postgres://postgres:password@localhost:5434/mastra';

describe('PostgreSQL Storage Tests', () => {
  beforeAll(async () => {
    await $({
      cwd: join(__dirname, '..'),
      stdio: 'inherit',
      detached: true,
    })`docker compose up -d postgres --wait`;
  });

  // Pool cleanup is handled inside getPgStorageTests via its own afterAll.
  // This afterAll runs last (vitest runs them in reverse registration order)
  // so by this point all PG pools have been gracefully closed.
  afterAll(async () => {
    return $({
      cwd: join(__dirname, '..'),
    })`docker compose down --volumes postgres`;
  });

  getPgStorageTests(connectionString);
});
