import { Mastra } from '@mastra/core';
import { Memory } from '@mastra/memory';
import { PostgresStore } from '@mastra/store-pg';
import { PgVector } from '@mastra/vector-pg';

import 'dotenv/config';

import { chefAgent, memoryAgent } from './agents';

const host = `localhost`;
const port = 5432;
const user = `postgres`;
const database = `postgres`;
const password = `postgres`;
const connectionString = `postgresql://${user}:${password}@${host}:${port}`;

const memory = new Memory({
  storage: new PostgresStore({
    host,
    port,
    user,
    database,
    password,
  }),
  vector: new PgVector(connectionString),
  options: {
    lastMessages: 10,
    historySearch: {
      topK: 3,
      messageRange: { before: 2, after: 2 },
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
