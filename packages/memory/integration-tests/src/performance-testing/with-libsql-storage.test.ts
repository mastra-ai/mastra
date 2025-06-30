import { LibSQLStore, LibSQLVector } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import dotenv from 'dotenv';
import { describe } from 'vitest';

import { getPerformanceTests } from './performance-tests';

dotenv.config({ path: '.env.test' });

describe('Memory with LibSQL Integration', () => {
  describe('with explicit storage', () => {
    const memory = new Memory({
      storage: new LibSQLStore({
        url: 'file:perf-test.db',
      }),
      options: {
        lastMessages: 10,
        semanticRecall: {
          topK: 3,
          messageRange: 2,
        },
      },
      vector: new LibSQLVector({
        connectionUrl: 'file:perf-test.db',
      }),
    });

    getPerformanceTests(memory);
  });
});
