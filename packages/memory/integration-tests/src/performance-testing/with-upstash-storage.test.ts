import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fastembed } from '@mastra/fastembed';
import { LibSQLVector } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { UpstashStore } from '@mastra/upstash';
import { $ } from 'execa';
import { describe, beforeAll, afterAll } from 'vitest';

import { getPerformanceTests } from './performance-tests';

const __dirname = fileURLToPath(import.meta.url);

describe('Memory with UpstashStore Performance', () => {
  let dbPath: string;

  beforeAll(async () => {
    dbPath = await mkdtemp(join(tmpdir(), `perf-test-`));

    return $({
      cwd: join(__dirname, '..', '..'),
      stdio: 'inherit',
      detached: true,
    })`docker compose up -d perf-serverless-redis-http perf-redis --wait`;
  });

  afterAll(async () => {
    // Clean up temp db files
    if (dbPath) {
      for (const file of fs.readdirSync(dbPath)) {
        fs.unlinkSync(join(dbPath, file));
      }
      fs.rmdirSync(dbPath);
    }

    return $({
      cwd: join(__dirname, '..', '..'),
    })`docker compose down --volumes perf-serverless-redis-http perf-redis`;
  });

  getPerformanceTests(() => {
    return new Memory({
      storage: new UpstashStore({
        id: 'perf-upstash-storage',
        url: 'http://localhost:8080',
        token: 'test_token',
      }),
      vector: new LibSQLVector({
        url: `file:${join(dbPath, 'perf-upstash-vector.db')}`,
        id: randomUUID(),
      }),
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
