import { Memory } from '@mastra/memory';
import { UpstashStore } from '@mastra/store-upstash';
import { LibSQLVector } from '@mastra/vector-libsql';
import dotenv from 'dotenv';
import { describe } from 'vitest';

import { getResuableTests } from './reusable-tests';

dotenv.config({ path: '.env.test' });

// Ensure environment variables are set
if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
  throw new Error('Required Vercel KV environment variables are not set');
}

describe('Memory with UpstashStore Integration', () => {
  const vector = new LibSQLVector({
    connectionUrl: 'file:test.db',
  });

  const memory = new Memory({
    storage: new UpstashStore({
      url: process.env.KV_REST_API_URL!,
      token: process.env.KV_REST_API_TOKEN!,
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
