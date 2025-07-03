import { openai } from '@ai-sdk/openai';
import { createTool } from '@mastra/core/tools';
import { Agent } from '@mastra/core/agent';
import { AnswerRelevancyScorer } from '@mastra/evals/scorers/llm';
import { z } from 'zod';

const model = openai('gpt-4o-mini');

export const evalAgent = new Agent({
  name: 'Eval Agent',
  instructions: 'You are a helpful assistant that can evaluate code.',
  model: model,
  tools: {
    getWeather: createTool({
      id: 'getWeather',
      description: 'Get the weather for a given city',
      inputSchema: z.object({
        city: z.string(),
      }),
      outputSchema: z.string(),
      execute: async ({ context }) => {
        return `The weather in ${context.city} is sunny`;
      },
    }),
  },
  scorers: {
    answerRelevancy: {
      scorer: new AnswerRelevancyScorer({ model }),
      sampling: {
        type: 'ratio',
        rate: 1,
      },
    },
  },
});
