import { google } from '@ai-sdk/google';
import { Memory } from '@mastra/memory';
import { Agent } from '@mastra/core/agent';

const memory = new Memory({
  options: {
    lastMessages: 20,
    semanticRecall: false,
    workingMemory: {
      enabled: true,
    },
  },
});

export const memoryTracingAgent = new Agent({
  id: 'memory-tracing-agent',
  name: 'Memory Tracing Agent',
  description: 'A simple agent with memory to test memory operation tracing in the playground.',
  instructions: `
    You are a helpful assistant with memory capabilities.
    Remember details the user tells you and recall them when asked.
    Use working memory to keep track of important facts about the user.
  `,
  model: google('gemini-2.5-flash'),
  memory,
});
