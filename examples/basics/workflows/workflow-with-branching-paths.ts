import { Workflow, Step } from '@mastra/core';
import { z } from 'zod';

const doubleValue = new Step({
  id: 'stepOne',
  description: 'Doubles the input value',
  inputSchema: z.object({
    inputValue: z.number(),
  }),
  outputSchema: z.object({
    doubledValue: z.number(),
  }),
  execute: async ({ context }) => {
    const doubledValue = context.inputValue * 2;
    return { doubledValue };
  },
});

const incrementByOne = new Step({
  id: 'stepTwo',
  description: 'Adds 1 to the input value',
  inputSchema: z.object({
    valueToIncrement: z.number(),
  }),
  outputSchema: z.object({
    incrementedValue: z.number(),
  }),
  execute: async ({ context }) => {
    const incrementedValue = context.valueToIncrement + 1;
    return { incrementedValue };
  },
});

const squareValue = new Step({
  id: 'stepThree',
  description: 'Squares the input value',
  inputSchema: z.object({
    valueToSquare: z.number(),
  }),
  outputSchema: z.object({
    squaredValue: z.number(),
  }),
  execute: async ({ context }) => {
    const squaredValue = context.valueToSquare * context.valueToSquare;
    return { squaredValue };
  },
});

export const branchedWorkflow = new Workflow({
  name: 'branched-workflow',
  triggerSchema: z.object({
    firstValue: z.number(),
  }),
});

branchedWorkflow
  .step(doubleValue, {
    variables: {
      inputValue: {
        step: 'trigger',
        path: 'firstValue',
      },
    },
  })
  .then(incrementByOne, {
    variables: {
      valueToIncrement: {
        step: doubleValue,
        path: 'doubledValue',
      },
    },
  })
  .after(doubleValue)
  .step(squareValue, {
    variables: {
      valueToSquare: {
        step: doubleValue,
        path: 'doubledValue',
      },
    },
  });

branchedWorkflow.commit();
const res = await branchedWorkflow.execute({ triggerData: { firstValue: 20 } });
console.log(res.results);
