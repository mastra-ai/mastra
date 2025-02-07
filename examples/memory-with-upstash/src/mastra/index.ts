import { Mastra } from '@mastra/core';
import { Memory } from '@mastra/memory';
import { UpstashStore } from '@mastra/store-upstash';
import { PgVector } from '@mastra/vector-pg';
import { OpenAIEmbedder } from '@mastra/core/embeddings/openai';

import { chefAgent, memoryAgent } from './agents';

const memory = new Memory({
  storage: new UpstashStore({
    url: 'http://localhost:8089',
    token: 'test_token',
  }),
  vector: new PgVector(`postgresql://postgres:postgres@localhost:5433`),
  options: {
    lastMessages: 1,
    semanticRecall: {
      topK: 3,
      messageRange: 2,
    },
  },
  embedder: new OpenAIEmbedder({
    model: 'text-embedding-3-small',
    maxRetries: 3,
  }),
});

export const mastra = new Mastra({
  agents: { chefAgent, memoryAgent },
  memory,
});
