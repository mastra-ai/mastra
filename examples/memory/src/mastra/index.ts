import { Mastra } from '@mastra/core';
import { Memory } from '@mastra/memory';
import { PgVector } from '@mastra/rag';
import { PostgresStore } from '@mastra/store-pg';

import 'dotenv/config';

import { chefAgent, memoryAgent } from './agents';

const connectionString = process.env.POSTGRES_CONNECTION_STRING;

if (!connectionString) {
  throw new Error(`process.env.POSTGRES_CONNECTION_STRING is required for this example to work`);
}

const memory = new Memory({
  storage: new PostgresStore({
    connectionString,
  }),
  vector: new PgVector(connectionString),
  threads: {
    injectRecentMessages: 10,
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
