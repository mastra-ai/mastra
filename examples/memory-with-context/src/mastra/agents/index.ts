import { Agent } from '@mastra/core/agent';
import { MastraStorageLibSql } from '@mastra/core/storage';
import { Memory } from '@mastra/memory';
import { LibSQLVector } from '@mastra/core/vector/libsql';

const memory = new Memory({
  storage: new MastraStorageLibSql({
    config: {
      url: 'file:example.db',
    },
  }),
  vector: new LibSQLVector({
    connectionUrl: 'file:example.db',
  }),
  options: {
    lastMessages: 4,
    semanticRecall: {
      topK: 1,
      messageRange: 0,
    },
    workingMemory: {
      enabled: true,
    },
  },
  embedding: {
    provider: 'OPEN_AI',
    model: 'text-embedding-3-small',
    maxRetries: 3,
  },
});

export const memoryAgent = new Agent({
  name: 'Memory Agent',
  instructions: 'You are a helpful AI agent, looking to assist however you can.',
  model: {
    provider: 'OPEN_AI',
    name: 'gpt-4o',
    toolChoice: 'auto',
  },
  memory,
});
