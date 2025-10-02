import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';

const stepOne = createStep({
  id: 'stepOne',
  inputSchema: z.object({
    inputValue: z.number(),
  }),
  outputSchema: z.object({
    doubledValue: z.number(),
    isOriginalOdd: z.boolean(), // Track original parity
  }),
  execute: async ({ inputData }) => {
    const doubledValue = inputData.inputValue * 2;
    const isOriginalOdd = inputData.inputValue % 2 === 1;
    return { doubledValue, isOriginalOdd };
  },
});

const stepTwo = createStep({
  id: 'stepTwo',
  inputSchema: z.object({
    doubledValue: z.number(),
    isOriginalOdd: z.boolean(),
  }),
  outputSchema: z.object({
    incrementedValue: z.number(),
  }),
  execute: async ({ inputData }) => {
    // Increment only if original input was odd
    const incrementedValue = inputData.doubledValue + (inputData.isOriginalOdd ? 1 : 0);
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
  execute: async ({ inputData, getStepResult }) => {
    try {
      const stepTwoResult = getStepResult(stepTwo);
      if (!stepTwoResult || typeof stepTwoResult.incrementedValue !== 'number') {
        throw new Error('stepTwo failed or returned invalid data');
      }
    } catch (error) {
      throw new Error(`stepTwo failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

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
  execute: async ({ inputData, getStepResult }) => {
    try {
      const stepThreeResult = getStepResult(stepThree);
      if (!stepThreeResult || typeof stepThreeResult.tripledValue !== 'number') {
        throw new Error('stepThree failed or returned invalid data');
      }
    } catch (error) {
      throw new Error(`stepThree failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    const isEven = inputData.tripledValue % 2 === 0;
    return { isEven };
  },
});

export const myWorkflow = createWorkflow({
  id: 'my-workflow',
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
  .then(stepFour);

myWorkflow.commit();
