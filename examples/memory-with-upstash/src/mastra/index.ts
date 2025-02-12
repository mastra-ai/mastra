import { Mastra } from '@mastra/core';
import { Memory } from '@mastra/memory';
import { PgVector } from '@mastra/pg';
import { UpstashStore } from '@mastra/upstash';

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
});

export const mastra = new Mastra({
  agents: { chefAgent, memoryAgent },
  memory,
});
