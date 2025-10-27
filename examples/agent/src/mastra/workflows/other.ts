import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';

const personSchema = z.object({
  name: z.string().default('John Doe'),
  number: z
    .union([z.number(), z.object({ prefix: z.string(), value: z.number() })])
    .default({ prefix: 'tel', value: 0 }),
  profession: z.intersection(
    z.object({ title: z.string().default('developer') }),
    z.object({ tools: z.array(z.string()).default(['React']) }),
  ),
  // profession: z.discriminatedUnion('type', [
  //   z.object({ type: z.literal('developer'), languages: z.array(z.string()) }),
  //   z.object({ type: z.literal('designer'), tools: z.array(z.string()) }),
  // ]),
});
// .default({ name: 'John Doe', number: { prefix: 'tel', value: 0 } });

const stepOne = createStep({
  id: 'stepOne',
  inputSchema: z.object({
    inputValue: z.number(),
    person: personSchema.optional(),
  }),
  outputSchema: z.object({
    doubledValue: z.number(),
  }),
  execute: async ({ inputData }) => {
    console.log('inputData', inputData);
    // await new Promise(resolve => setTimeout(resolve, 10_000));
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
    person: personSchema.optional(),
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

export const myWorkflowX = createWorkflow({
  id: 'my-workflow',
  inputSchema: z.object({
    inputValue: z.number(),
    person: personSchema.optional(),
  }),
  outputSchema: z.object({
    isEven: z.boolean(),
  }),
})
  .then(nestedWorkflow)
  .commit();
