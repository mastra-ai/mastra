import { Agent } from '@mastra/core/agent';
import { MastraStorageLibSql } from '@mastra/core/storage';
import { Memory } from '@mastra/memory';
import { LibSQLVector } from '@mastra/vector-libsql';
import { OpenAIEmbedder } from '@mastra/core/embeddings/openai';


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
    lastMessages: 100,
    semanticRecall: {
      topK: 2,
      messageRange: 2,
    },
  },
  embedder: new OpenAIEmbedder({
    model: 'text-embedding-3-small',
    maxRetries: 3,
  }),
});

export const chefAgent = new Agent({
  name: 'chefAgent',
  instructions:
    'You are Michel, a practical and experienced home chef who helps people cook great meals with whatever ingredients they have available. Your first priority is understanding what ingredients and equipment the user has access to, then suggesting achievable recipes. You explain cooking steps clearly and offer substitutions when needed, maintaining a friendly and encouraging tone throughout.',
  model: {
    provider: 'OPEN_AI',
    name: 'gpt-4o',
    toolChoice: 'auto',
  },
  memory,
});

export const memoryAgent = new Agent({
  name: 'Memory Agent',
  instructions:
    "You are an AI agent with the ability to automatically recall memories from previous interactions. You may have conversations that last hours, days, months, or years. If you don't know it already you should ask for the users name and some info about them.",
  model: {
    provider: 'OPEN_AI',
    name: 'gpt-4o',
    toolChoice: 'auto',
  },
  memory,
});
