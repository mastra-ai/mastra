import { Mastra, createLogger } from '@mastra/core';
import { PgMemory } from '@mastra/memory';

// import { PgVector } from '@mastra/rag';
import 'dotenv/config';

import { chefAgent } from './agents';

const connectionString = process.env.POSTGRES_CONNECTION_STRING;

if (!connectionString) {
  throw new Error(`process.env.POSTGRES_CONNECTION_STRING is required for this example to work`);
}

const pgMemory = new PgMemory({
  connectionString,
});
// export const pgVector = new PgVector(connectionString);

export const mastra = new Mastra({
  agents: { chefAgent },
  // vectors: { pgVector },
  memory: pgMemory,
  logger: createLogger({
    type: 'CONSOLE',
    level: 'ERROR',
  }),
});
