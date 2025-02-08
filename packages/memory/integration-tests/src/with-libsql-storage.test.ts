import { createOpenAI } from '@ai-sdk/openai';
import { DefaultStorage, DefaultVectorDB } from '@mastra/core/storage';
import { Memory } from '@mastra/memory';
import dotenv from 'dotenv';
import { describe } from 'vitest';

import { getResuableTests } from './reusable-tests';

dotenv.config({ path: '.env.test' });

const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });

describe('Memory with LibSQL Integration', () => {
  const vector = new DefaultVectorDB({
    connectionUrl: 'file:test.db',
  });

  const memory = new Memory({
    storage: new DefaultStorage({
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
    embedder: openai.embedding('text-embedding-3-small'),
  });

  getResuableTests(memory);
});
