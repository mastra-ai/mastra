import { createScorer } from '@mastra/core/scores';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';

export const myWorkflow = createWorkflow({
  id: 'recipe-maker',
  description: 'Returns a recipe based on an ingredient',
  inputSchema: z.object({
    ingredient: z.string(),
  }),
  outputSchema: z.object({
    result: z.string(),
  }),
});

const scorer = createScorer({
  name: 'recipe-maker123',
  description: 'Returns a recipe based on an ingredient',
}).generateScore(() => {
  return 1;
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
  execute: async ({ inputData }) => {
    await new Promise(resolve => setTimeout(resolve, 3000));
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
  // scorers: {
  //   recipeMaker: {
  //     scorer,
  //   },
  // },
  execute: async () => {
    return {
      result: 'suh',
    };
  },
});

myWorkflow.then(step).then(step2).commit();
