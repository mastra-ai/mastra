import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core';
import { Memory } from '@mastra/memory';
import { PgVector } from '@mastra/pg';
import { UpstashStore } from '@mastra/upstash';

const memory = new Memory({
  storage: new UpstashStore({
    url: 'http://localhost:8089',
    token: 'test_token',
  }),
  vector: new PgVector(`postgresql://postgres:postgres@localhost:5433`),
  options: {
    lastMessages: 1,
    semanticRecall: {
      topK: 3,
      messageRange: 2,
    },
  },
});

export const chefAgent = new Agent({
  name: 'chefAgent',
  memory,
  instructions:
    'You are Michel, a practical and experienced home chef who helps people cook great meals with whatever ingredients they have available. Your first priority is understanding what ingredients and equipment the user has access to, then suggesting achievable recipes. You explain cooking steps clearly and offer substitutions when needed, maintaining a friendly and encouraging tone throughout.',
  model: openai('gpt-4o'),
});

export const memoryAgent = new Agent({
  name: 'Memory Agent',
  memory,
  instructions:
    "You are an AI agent with the ability to automatically recall memories from previous interactions. You may have conversations that last hours, days, months, or years. If you don't know it already you should ask for the users name and some info about them.",
  model: openai('gpt-4o'),
});
