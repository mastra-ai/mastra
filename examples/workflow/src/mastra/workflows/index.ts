import { Workflow, Step } from '@mastra/core';
import { z } from 'zod';

const logCatName = new Step({
  id: 'logCatName',
  description: 'Log a cat name',
  inputSchema: z.object({
    name: z.string(),
  }),
  outputSchema: z.object({
    rawText: z.string(),
  }),
  execute: async ({ context }) => {
    console.log(`Hello, ${context.name} 🐈`);
    return { rawText: `Hello ${context.name}` };
  },
});

const stepOne = new Step({
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

const stepTwo = new Step({
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

const stepThree = new Step({
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

const stepFour = new Step({
  id: 'stepFour',
  description: 'Gives the square root of the input value',
  inputSchema: z.object({
    valueToRoot: z.number(),
  }),
  outputSchema: z.object({
    rootValue: z.number(),
  }),
  execute: async ({ context }) => {
    return { rootValue: Math.sqrt(context.valueToRoot) };
  },
});

const stepFive = new Step({
  id: 'stepFive',
  description: 'Triples the input value',
  inputSchema: z.object({
    inputValue: z.number(),
  }),
  outputSchema: z.object({
    tripledValue: z.number(),
  }),
  execute: async ({ context }) => {
    const tripledValue = context.inputValue * 3;
    return { tripledValue };
  },
});

const stepSix = new Step({
  id: 'stepSix',
  description: 'Logs the input value',
  inputSchema: z.object({
    inputValue: z.number(),
  }),
  outputSchema: z.object({
    rawText: z.string(),
  }),
  execute: async ({ context }) => {
    console.log(context.inputValue);
    return { rawText: context.inputValue.toString() };
  },
});

export const sequentialWorkflow = new Workflow({
  name: 'sequential-workflow',
  triggerSchema: z.object({
    firstValue: z.number(),
  }),
});

sequentialWorkflow
  .step(stepOne, {
    variables: {
      inputValue: {
        step: 'trigger',
        path: 'firstValue',
      },
    },
  })
  .then(stepTwo, {
    variables: {
      valueToIncrement: {
        step: stepOne,
        path: 'doubledValue',
      },
    },
  })
  .then(stepThree)
  .then(stepFour)
  .then(stepFive);

sequentialWorkflow.commit();

export const parallelWorkflow = new Workflow({
  name: 'parallel-workflow',
  triggerSchema: z.object({
    firstValue: z.number(),
  }),
});

parallelWorkflow.step(stepOne).step(stepTwo).step(stepThree);

parallelWorkflow.commit();

export const branchedWorkflow = new Workflow({
  name: 'branched-workflow',
  triggerSchema: z.object({
    firstvalue: z.number(),
  }),
});

branchedWorkflow.step(stepOne).then(stepTwo).then(stepFour).after(stepOne).step(stepThree).then(stepFive);

branchedWorkflow.commit();

export const cyclicalWorkflow = new Workflow({
  name: 'cyclical-workflow',
  triggerSchema: z.object({
    firstvalue: z.number(),
  }),
});

cyclicalWorkflow
  .step(stepOne)
  .then(stepTwo)
  .after(stepOne)
  .step(stepThree, {
    when: { ref: { step: stepOne, path: 'doubledValue' }, query: { $eq: 10 } },
  })
  .step(stepOne, {
    when: {
      ref: { step: stepOne, path: 'doubledValue' },
      query: { $eq: 12 },
    },
  });

cyclicalWorkflow.commit();
