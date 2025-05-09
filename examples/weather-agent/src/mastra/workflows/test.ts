import { Step, Workflow } from '@mastra/core/workflows';
import { z } from 'zod';

const stepOne = new Step({
  id: 'stepOne',
  outputSchema: z.object({
    doubledValue: z.number(),
  }),
  execute: async ({ context }) => {
    console.log('stepOne');
    console.log('context', context);
    const doubledValue = context.triggerData.inputValue * 2;
    return { doubledValue };
  },
});

const stepTwo = new Step({
  id: 'stepTwo',
  outputSchema: z.object({
    incrementedValue: z.number(),
  }),
  execute: async ({ context, suspend }) => {
    console.log('stepTwo');
    const secondValue = context.inputData?.secondValue ?? 0;
    const doubledValue = context.getStepResult(stepOne)?.doubledValue ?? 0;

    const incrementedValue = doubledValue + secondValue;

    console.log('incrementedValue', incrementedValue);
    if (incrementedValue < 100) {
      console.log('Suspending stepTwo');
      await suspend();
      return { incrementedValue: 0 };
    }
    console.log('Returning stepTwo');
    return { incrementedValue };
  },
});

// Build the workflow
export const myWorkflow = new Workflow({
  name: 'my-workflow',
  triggerSchema: z.object({
    inputValue: z.number(),
  }),
});

myWorkflow.step(stepOne).then(stepTwo).commit();
