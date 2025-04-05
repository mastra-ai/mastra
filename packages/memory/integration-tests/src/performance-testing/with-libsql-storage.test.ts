import { DefaultStorage } from '@mastra/core/storage/libsql';
import { Memory } from '@mastra/memory';
import dotenv from 'dotenv';
import { describe } from 'vitest';

import { getPerformanceTests } from './performance-tests';

dotenv.config({ path: '.env.test' });

describe('Memory with LibSQL Integration', () => {
  describe('with explicit storage', () => {
    const memory = new Memory({
      storage: new DefaultStorage({
        config: {
          url: 'file:test.db',
        },
      }),
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

  describe('with default storage', () => {
    const memory = new Memory({
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
});
