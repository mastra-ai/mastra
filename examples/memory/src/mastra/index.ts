import { Mastra } from '@mastra/core';
import { Memory } from '@mastra/memory';
// import { PgVector } from '@mastra/rag';
import { PostgresStore } from '@mastra/store-pg';

import 'dotenv/config';

import { chefAgent, memoryAgent } from './agents';

const connectionString = process.env.POSTGRES_CONNECTION_STRING;

if (!connectionString) {
  throw new Error(`process.env.POSTGRES_CONNECTION_STRING is required for this example to work`);
}

const memory = new Memory({
  threads: {
    injectRecentMessages: 10,
  },
  storage: new PostgresStore({
    connectionString,
  }),
  // vector: new PgVector(connectionString),
});

export const mastra = new Mastra({
  agents: { chefAgent, memoryAgent },
  memory,
});
