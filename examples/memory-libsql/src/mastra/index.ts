import { Mastra } from '@mastra/core';
import { MastraStorageLibSql } from '@mastra/core/storage';
import { Memory } from '@mastra/memory';
import { LibSQLVector } from '@mastra/vector-libsql';

import { chefAgent, memoryAgent } from './agents';

const storage = new MastraStorageLibSql({
  config: {
    url: 'file:example.db',
  },
});

const vector = new LibSQLVector({
  connectionUrl: 'file:example.db',
});

const memory = new Memory({
  storage,
  vector,
  options: {
    lastMessages: 100,
    historySearch: {
      topK: 2,
      messageRange: { before: 2, after: 2 },
    },
  },
  embeddingOptions: {
    provider: 'OPEN_AI',
    model: 'text-embedding-3-small',
    maxRetries: 3,
  },
});

export const mastra = new Mastra({
  agents: { chefAgent, memoryAgent },
  memory,
});
