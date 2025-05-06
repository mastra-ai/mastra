import { createWorkflow, createStep } from '@mastra/core/workflows/vNext';
import { z } from 'zod';

const logCatName = createStep({
  id: 'logCatName',
  inputSchema: z.object({
    name: z.string(),
  }),
  outputSchema: z.object({
    rawText: z.string(),
  }),
  execute: async ({ inputData }) => {
    console.log(`Hello, ${inputData.name} 🐈`);
    return { rawText: `Hello ${inputData.name}` };
  },
});

const stepTwo = createStep({
  id: 'stepTwo',
  inputSchema: z.object({
    rawText: z.string(),
  }),
  outputSchema: z.object({
    stepTwoResult: z.string(),
  }),
  execute: async ({ inputData }) => {
    return { stepTwoResult: `Hello ${inputData.rawText}` };
  },
});

const stepThree = createStep({
  id: 'stepThree',
  inputSchema: z.object({
    stepTwoResult: z.string(),
  }),
  outputSchema: z.object({
    name: z.string(),
  }),
  execute: async ({ inputData }) => {
    return { name: `Hello ${inputData.stepTwoResult}` };
  },
});

const stepFour = createStep({
  id: 'stepFour',
  inputSchema: z.object({
    rawText: z.string(),
  }),
  outputSchema: z.object({
    stepFourResult: z.string(),
  }),
  execute: async ({ inputData }) => {
    return { stepFourResult: `Hello ${inputData.rawText}` };
  },
});

export const logCatWorkflow = createWorkflow({
  id: 'log-cat-workflow',
  inputSchema: z.object({
    name: z.string(),
  }),
  outputSchema: z.object({
    rawText: z.string(),
  }),
  steps: [logCatName],
})
  .then(logCatName)
  .then(stepTwo)
  .then(stepThree)
  .then(logCatName)
  .then(stepFour)
  .commit();
