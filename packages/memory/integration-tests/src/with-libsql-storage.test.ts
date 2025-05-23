import { fastembed } from '@mastra/fastembed';
import { LibSQLStore, LibSQLVector } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import dotenv from 'dotenv';
import { describe } from 'vitest';

import { getResuableTests } from './reusable-tests';

dotenv.config({ path: '.env.test' });

describe('Memory with LibSQL Integration', () => {
  const memory = new Memory({
    storage: new LibSQLStore({
      url: 'file:libsql-test.db',
    }),
    vector: new LibSQLVector({
      connectionUrl: 'file:libsql-test.db',
    }),
    embedder: fastembed,
    options: {
      lastMessages: 10,
      semanticRecall: {
        topK: 3,
        messageRange: 2,
      },
      threads: {
        generateTitle: false,
      },
    },
  });

  getResuableTests(memory);
});
