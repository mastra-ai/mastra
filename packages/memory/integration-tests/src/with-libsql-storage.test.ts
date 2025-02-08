import { OpenAIEmbedder } from '@mastra/core/embeddings/openai';
import { DefaultStorage, DefaultVectorDB } from '@mastra/core/storage';
import { Memory } from '@mastra/memory';
import dotenv from 'dotenv';
import { describe } from 'vitest';

import { getResuableTests } from './reusable-tests';

dotenv.config({ path: '.env.test' });

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
    embedder: new OpenAIEmbedder({
      model: 'text-embedding-3-small',
    }),
  });

  getResuableTests(memory);
});
