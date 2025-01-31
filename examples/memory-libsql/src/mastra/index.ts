import { Mastra, MastraStorageLibSql } from '@mastra/core';
import { Memory } from '@mastra/memory';
import { PgVector } from '@mastra/vector-pg';

import { chefAgent, memoryAgent } from './agents';

const storage = new MastraStorageLibSql({
  config: {
    url: 'file:example.db',
  },
});

const vector = new PgVector(`postgresql://postgres:postgres@localhost:5433`);

const memory = new Memory({
  storage,
  vector,
  threads: {
    injectRecentMessages: 100,
    injectVectorHistorySearch: {
      includeResults: 2,
      includeNext: 2,
      includePrevious: 2,
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
