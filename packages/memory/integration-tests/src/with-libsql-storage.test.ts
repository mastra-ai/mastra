import { MastraStorageLibSql } from '@mastra/core/storage';
import { Memory } from '@mastra/memory';
import { LibSQLVector } from '@mastra/core/vector/libsql';
import dotenv from 'dotenv';
import { describe } from 'vitest';

import { getResuableTests } from './reusable-tests';

dotenv.config({ path: '.env.test' });

describe('Memory with LibSQL Integration', () => {
  const vector = new LibSQLVector({
    connectionUrl: 'file:test.db',
  });

  const memory = new Memory({
    storage: new MastraStorageLibSql({
      config: {
        url: 'file:test.db',
      },
    }),
    vector,
    options: {
      lastMessages: 10,
      semanticRecall: {
        topK: 3,
        messageRange: 2,
      },
    },
    embedding: {
      provider: 'OPEN_AI',
      model: 'text-embedding-ada-002',
      maxRetries: 3,
    },
  });

  getResuableTests(memory);
});
