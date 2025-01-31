import { Mastra, MastraStorageLibSql } from '@mastra/core';
import { Memory } from '@mastra/memory';

import 'dotenv/config';

import { chefAgent, memoryAgent } from './agents';

const connectionString = process.env.POSTGRES_CONNECTION_STRING;

if (!connectionString) {
  throw new Error(`process.env.POSTGRES_CONNECTION_STRING is required for this example to work`);
}

const memory = new Memory({
  storage: new MastraStorageLibSql({
    config: {
      url: 'file:example.db',
    },
  }),
  threads: {
    injectRecentMessages: 1,
  },
});

export const mastra = new Mastra({
  agents: { chefAgent, memoryAgent },
  memory,
});
