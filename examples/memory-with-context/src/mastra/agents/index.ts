import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';

const memory = new Memory({
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
});

export const memoryAgent = new Agent({
  name: 'Memory Agent',
  instructions: 'You are a helpful AI agent, looking to assist however you can.',
  model: openai('gpt-4o-mini'),
  memory,
});
