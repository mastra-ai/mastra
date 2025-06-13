import { env } from 'node:process';
import { Memory } from '@mastra/memory';
import { UpstashStore } from '@mastra/upstash';
import dotenv from 'dotenv';
import { describe } from 'vitest';

import { getPerformanceTests } from './performance-tests';

dotenv.config({ path: '.env.test' });

// Ensure environment variables are set
if (!env.KV_REST_API_URL || !env.KV_REST_API_TOKEN) {
  throw new Error('Required Vercel KV environment variables are not set');
}

describe('Memory with UpstashStore Integration', () => {
  const memory = new Memory({
    storage: new UpstashStore({
      url: env.KV_REST_API_URL!,
      token: env.KV_REST_API_TOKEN!,
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
