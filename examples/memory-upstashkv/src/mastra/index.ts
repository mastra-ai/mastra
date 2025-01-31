import { Mastra } from '@mastra/core';
import { Memory } from '@mastra/memory';
import { UpstashStore } from '@mastra/store-upstash';
import { PgVector } from '@mastra/vector-pg';

import { chefAgent, memoryAgent } from './agents';

const host = `localhost`;
const port = 5433;
const user = `postgres`;
const password = `postgres`;
const connectionString = `postgresql://${user}:${password}@${host}:${port}`;

const memory = new Memory({
  storage: new UpstashStore({
    url: 'http://localhost:8089',
    token: 'test_token',
  }),
  vector: new PgVector(connectionString),
  threads: {
    injectRecentMessages: 1,
    injectVectorHistorySearch: {
      includeResults: 3,
      includePrevious: 2,
      includeNext: 2,
    },
  },
  embeddingOptions: {
    provider: 'OPEN_AI',
    model: 'text-embedding-ada-002',
    maxRetries: 3,
  },
});

export const mastra = new Mastra({
  agents: { chefAgent, memoryAgent },
  memory,
});
