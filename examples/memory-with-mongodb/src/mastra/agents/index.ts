import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { MongoDBStore, MongoDBVector } from '@mastra/mongodb';

// This URI must be an Atlas MongoDB deployment in order to work with vector search
// in the format mongodb+srv://<username>:<password>@<cluster>.mongodb.net
const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB_NAME || 'mastra_memory';

export const memory = new Memory({
  storage: new MongoDBStore({
    url: uri,
    dbName,
  }),
  vector: new MongoDBVector({
    uri,
    dbName,
  }),
  options: {
    lastMessages: 10,
    semanticRecall: {
      topK: 3,
      messageRange: 2,
    },
  },
  embedder: openai.embedding('text-embedding-3-small'),
});

export const chefAgent = new Agent({
  id: 'chef-agent',
  name: 'Chef Agent',
  instructions:
    'You are Michel, a practical and experienced home chef who helps people cook great meals with whatever ingredients they have available. Your first priority is understanding what ingredients and equipment the user has access to, then suggesting achievable recipes. You explain cooking steps clearly and offer substitutions when needed, maintaining a friendly and encouraging tone throughout.',
  model: openai('gpt-4o'),
  memory,
});

export const memoryAgent = new Agent({
  id: 'memory-agent',
  name: 'Memory Agent',
  instructions:
    "You are an AI agent with the ability to automatically recall memories from previous interactions. You may have conversations that last hours, days, months, or years. If you don't know it already you should ask for the users name and some info about them.",
  model: openai('gpt-4o'),
  memory,
});
