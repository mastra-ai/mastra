import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';

const memory = new Memory({
  options: {
    lastMessages: 100,
    semanticRecall: {
      topK: 2,
      messageRange: 2,
    },
  },
});

export const chefAgent = new Agent({
  name: 'chefAgent',
  instructions:
    'You are Michel, a practical and experienced home chef who helps people cook great meals with whatever ingredients they have available. Your first priority is understanding what ingredients and equipment the user has access to, then suggesting achievable recipes. You explain cooking steps clearly and offer substitutions when needed, maintaining a friendly and encouraging tone throughout.',
  model: openai('gpt-4o'),
  memory,
});

export const memoryAgent = new Agent({
  name: 'Memory Agent',
  instructions:
    "You are an AI agent with the ability to automatically recall memories from previous interactions. You may have conversations that last hours, days, months, or years. If you don't know it already you should ask for the users name and some info about them.",
  model: openai('gpt-4o'),
  memory,
});
