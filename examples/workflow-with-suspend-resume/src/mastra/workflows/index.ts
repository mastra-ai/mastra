import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';

const stepOne = createStep({
  id: 'stepOne',
  inputSchema: z.object({
    inputValue: z.number(),
  }),
  outputSchema: z.object({
    doubledValue: z.number(),
  }),
  execute: async ({ inputData }) => {
    const doubledValue = inputData.inputValue * 2;
    return { doubledValue };
  },
});

const stepTwo = createStep({
  id: 'stepTwo',
  inputSchema: z.object({
    doubledValue: z.number(),
  }),
  outputSchema: z.object({
    incrementedValue: z.number(),
  }),
  suspendSchema: z.object({}),
  resumeSchema: z.object({
    extraNumber: z.number(),
  }),
  execute: async ({ inputData, resumeData, suspend }) => {
    if (!resumeData?.extraNumber) {
      await suspend({});
      return { incrementedValue: 0 };
    }
    const incrementedValue = inputData.doubledValue + 1 + resumeData.extraNumber;
    return { incrementedValue };
  },
});

const stepThree = createStep({
  id: 'stepThree',
  inputSchema: z.object({
    incrementedValue: z.number(),
  }),
  outputSchema: z.object({
    tripledValue: z.number(),
  }),
  execute: async ({ inputData }) => {
    const tripledValue = inputData.incrementedValue * 3;
    return { tripledValue };
  },
});

const stepFour = createStep({
  id: 'stepFour',
  inputSchema: z.object({
    tripledValue: z.number(),
  }),
  outputSchema: z.object({
    isEven: z.boolean(),
  }),
  execute: async ({ inputData }) => {
    const isEven = inputData.tripledValue % 2 === 0;
    return { isEven };
  },
});

// Create a nested workflow
export const nestedWorkflow = createWorkflow({
  id: 'data-processing',
  inputSchema: z.object({
    inputValue: z.number(),
  }),
  outputSchema: z.object({
    isEven: z.boolean(),
  }),
})
  .then(stepOne)
  .then(stepTwo)
  .then(stepThree)
  .then(stepFour)
  .commit();

export const myWorkflow = createWorkflow({
  id: 'my-workflow',
  inputSchema: z.object({
    inputValue: z.number(),
  }),
  outputSchema: z.object({
    isEven: z.boolean(),
  }),
})
  .then(nestedWorkflow)
  .commit();
