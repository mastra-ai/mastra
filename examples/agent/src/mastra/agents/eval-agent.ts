import { openai } from '@ai-sdk/openai';
import { createTool } from '@mastra/core/tools';
import { Agent } from '@mastra/core/agent';
import { createAnswerRelevancyScorer } from '@mastra/evals/scorers/llm';
// import { createCompletenessScorer } from '@mastra/evals/scorers/code';
import { z } from 'zod';

const model = openai('gpt-4o-mini');

const answerRelevancyScorer = createAnswerRelevancyScorer({ model });

// const completenessScorer = createCompletenessScorer();

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
    // completeness: {
    //   scorer: completenessScorer,
    //   sampling: {
    //     type: 'ratio',
    //     rate: 1,
    //   },
    // },
    answerRelevancy: {
      scorer: answerRelevancyScorer,
      sampling: {
        type: 'ratio',
        rate: 1,
      },
    },
  },
});
