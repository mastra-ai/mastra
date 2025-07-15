import { openai } from '@ai-sdk/openai';
import { createStep, createWorkflow } from '@mastra/core/workflows';
// import { createCompletenessScorer } from '@mastra/evals/scorers/code';
import { createAnswerRelevancyScorer } from '@mastra/evals/scorers/llm';
import { z } from 'zod';

export const myWorkflow = createWorkflow({
  id: 'my-workflow',
  description: 'My workflow description',
  inputSchema: z.object({
    ingredient: z.string(),
  }),
  outputSchema: z.object({
    result: z.string(),
  }),
});

const step = createStep({
  id: 'my-step',
  description: 'My step description',
  inputSchema: z.object({
    ingredient: z.string(),
  }),
  outputSchema: z.object({
    result: z.string(),
  }),
  scorers: {
    // completeness: {
    //   scorer: createCompletenessScorer(),
    // },
    answerRelevancy: {
      scorer: createAnswerRelevancyScorer({
        model: openai('gpt-4o-mini'),
      }),
    },
  },
  execute: async ({ inputData }) => {
    return {
      result: inputData.ingredient,
    };
  },
});

const step2 = createStep({
  id: 'my-step-2',
  description: 'My step description',
  inputSchema: z.object({
    result: z.string(),
  }),
  outputSchema: z.object({
    result: z.string(),
  }),
  execute: async ({ inputData, mastra }) => {
    const agent = mastra.getAgent('chefAgentResponses');
    const response = await agent.generate(inputData.result);
    return {
      result: 'suh',
    };
  },
});

myWorkflow.then(step).then(step2).commit();
