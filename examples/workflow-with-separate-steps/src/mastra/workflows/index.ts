import { Step, Workflow } from '@mastra/core/workflows';
import { z } from 'zod';

const stepOne = new Step({
  id: 'stepOne',
  execute: async ({ context }) => {
    const triggerData = context?.triggerData;
    const doubledValue = triggerData.inputValue * 2;
    return { doubledValue };
  },
});

const stepTwo = new Step({
  id: 'stepTwo',
  execute: async ({ context }) => {
    if (context?.steps.stepOne.status !== 'success') {
      throw new Error('stepOne failed');
    }
    const stepOneResult = context?.steps.stepOne?.output;
    const incrementedValue = stepOneResult.doubledValue + 1;
    return { incrementedValue };
  },
});

const stepThree = new Step({
  id: 'stepThree',
  execute: async ({ context }) => {
    const triggerData = context?.triggerData;
    const tripledValue = triggerData.inputValue * 3;
    return { tripledValue };
  },
});

const stepFour = new Step({
  id: 'stepFour',
  execute: async ({ context }) => {
    if (context?.steps.stepThree.status !== 'success') {
      throw new Error('stepThree failed');
    }
    const stepThreeResult = context?.steps.stepThree?.output;
    const isEven = stepThreeResult.tripledValue % 2 === 0;
    return { isEven };
  },
});

export const myWorkflow = new Workflow({
  name: 'my-workflow',
  triggerSchema: z.object({
    inputValue: z.number(),
  }),
});

myWorkflow.step(stepOne).then(stepTwo).step(stepThree).then(stepFour).commit();

const { start } = myWorkflow.createRun();

const result = await start({ triggerData: { inputValue: 3 } });

console.log(result);
