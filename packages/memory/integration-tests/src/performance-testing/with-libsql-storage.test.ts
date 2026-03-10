import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fastembed } from '@mastra/fastembed';
import { LibSQLStore, LibSQLVector } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { afterAll, beforeAll, describe } from 'vitest';

import { getPerformanceTests } from './performance-tests';

describe('Memory with LibSQL Performance', () => {
  let dbPath: string;

  beforeAll(async () => {
    dbPath = await mkdtemp(join(tmpdir(), `perf-test-`));
  });

  afterAll(async () => {
    await rm(dbPath, { recursive: true });
  });

  getPerformanceTests(() => {
    return new Memory({
      storage: new LibSQLStore({
        id: 'perf-test-storage',
        url: `file:${dbPath}/perf-test.db`,
      }),
      vector: new LibSQLVector({
        id: 'perf-test-vector',
        url: `file:${dbPath}/perf-test.db`,
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
