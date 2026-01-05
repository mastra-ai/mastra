import dotenv from 'dotenv';
import { describe } from 'vitest';

import { getPgStorageTests } from './shared/with-pg-storage';

dotenv.config({ path: '.env.test' });

// Ensure environment variables are set
if (!process.env.DB_URL) {
  console.warn('DB_URL not set, using default local PostgreSQL connection');
}

const connectionString = process.env.DB_URL || 'postgres://postgres:password@localhost:5434/mastra';

describe('PostgreSQL Storage Tests', () => {
  getPgStorageTests(connectionString);
});
