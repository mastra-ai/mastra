import { Memory } from '@mastra/memory';
import { PostgresStore, PgVector } from '@mastra/pg';
import dotenv from 'dotenv';
import { describe } from 'vitest';

import { getPerformanceTests } from './performance-tests';

dotenv.config({ path: '.env.test' });

// Ensure environment variables are set
if (!process.env.DB_URL) {
  console.warn('DB_URL not set, using default local PostgreSQL connection');
}

const connectionString = process.env.DB_URL || 'postgres://postgres:password@localhost:5434/mastra';

const parseConnectionString = (url: string) => {
  const parsedUrl = new URL(url);
  return {
    host: parsedUrl.hostname,
    port: parseInt(parsedUrl.port),
    user: parsedUrl.username,
    password: parsedUrl.password,
    database: parsedUrl.pathname.slice(1),
  };
};

describe('Memory with PostgresStore Integration', () => {
  const config = parseConnectionString(connectionString);
  const memory = new Memory({
    storage: new PostgresStore(config),
    vector: new PgVector(connectionString),
    options: {
      lastMessages: 10,
      semanticRecall: {
        topK: 3,
        messageRange: 2,
      },
    },
  });

  getPerformanceTests(memory);
});
