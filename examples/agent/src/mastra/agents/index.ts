import { openai } from '@ai-sdk/openai';
import { Memory } from '@mastra/memory';
import { Agent } from '@mastra/core/agent';
import { z } from 'zod';

const memory = new Memory({
  options: {
    workingMemory: {
      enabled: true,
      schema: z.object({
        ingredient: z.string(),
      }),
    },
  },
});

export const workingMemoryAgent = new Agent({
  name: 'Working Memory Agent',
  instructions:
    'You are a working memory agent. When the user provides an ingredient, you should store it in your working memory.',
  model: openai('gpt-4o-mini'),
  memory,
});
