import { Mastra, MastraStorageLibSql } from '@mastra/core';
import { Memory } from '@mastra/memory';
import { PgVector } from '@mastra/vector-pg';

import 'dotenv/config';

import { chefAgent, memoryAgent } from './agents';

const host = `localhost`;
const port = 5432;
const user = `postgres`;
const password = `postgres`;
const connectionString = `postgresql://${user}:${password}@${host}:${port}`;

const memory = new Memory({
  storage: new MastraStorageLibSql({
    config: {
      url: 'file:example.db',
    },
  }),
  vector: new PgVector(connectionString),
  threads: {
    injectRecentMessages: 1,
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
