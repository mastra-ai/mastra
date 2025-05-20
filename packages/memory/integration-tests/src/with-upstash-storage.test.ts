import { fastembed } from '@mastra/fastembed';
import { LibSQLVector } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { UpstashStore } from '@mastra/upstash';
import { describe } from 'vitest';

import { getResuableTests } from './reusable-tests';

describe('Memory with UpstashStore Integration', () => {
  const memory = new Memory({
    storage: new UpstashStore({
      url: 'http://localhost:8079',
      token: 'test_token',
    }),
    vector: new LibSQLVector({
      // TODO: use upstash vector in tests
      connectionUrl: 'file:upstash-test-vector.db',
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
