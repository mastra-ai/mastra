import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fastembed } from '@mastra/fastembed';
import { Memory } from '@mastra/memory';
import { PostgresStore, PgVector } from '@mastra/pg';
import { $ } from 'execa';
import { afterAll, beforeAll, describe } from 'vitest';

import { getPerformanceTests } from './performance-tests';

const __dirname = fileURLToPath(import.meta.url);
const connectionString = process.env.PERF_DB_URL || 'postgres://postgres:password@localhost:5435/mastra';

const parseConnectionString = (url: string) => {
  const parsedUrl = new URL(url);
  return {
    id: 'perf-test-storage',
    host: parsedUrl.hostname,
    port: parseInt(parsedUrl.port),
    user: parsedUrl.username,
    password: parsedUrl.password,
    database: parsedUrl.pathname.slice(1),
  };
};

// Track connections so we can close them before Docker teardown
let storage: PostgresStore | undefined;
let vector: PgVector | undefined;

describe('Memory with PostgresStore Performance', () => {
  beforeAll(async () => {
    await $({
      cwd: join(__dirname, '..', '..'),
      stdio: 'inherit',
      detached: true,
    })`docker compose up -d perf-postgres --wait`;
  });

  afterAll(async () => {
    // Gracefully close all PG pools before tearing down Docker
    await Promise.allSettled([storage?.close(), vector?.disconnect()]);

    return $({
      cwd: join(__dirname, '..', '..'),
    })`docker compose down --volumes perf-postgres`;
  });

  getPerformanceTests(() => {
    const config = parseConnectionString(connectionString);
    storage = new PostgresStore(config);
    vector = new PgVector({ connectionString, id: 'perf-test-vector' });

    return new Memory({
      storage,
      vector,
      embedder: fastembed.small,
      options: {
        lastMessages: 10,
        semanticRecall: {
          topK: 3,
          messageRange: 2,
        },
      },
    });
  });
});
