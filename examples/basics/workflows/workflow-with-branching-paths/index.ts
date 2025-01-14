import { Step, Workflow } from '@mastra/core';
import { z } from 'zod';

const stepOne = new Step({
  id: 'stepOne',
  execute: async ({ context }) => {
    const triggerData = context.machineContext?.triggerData;
    const doubledValue = triggerData.inputValue * 2;
    return { doubledValue };
  },
});

const stepTwo = new Step({
  id: 'stepTwo',
  execute: async ({ context }) => {
    const stepOneResult = context.machineContext?.getStepResults.stepOne.result;
    const incrementedValue = stepOneResult.doubledValue + 1;
    return { incrementedValue };
  },
});

const stepThree = new Step({
  id: 'stepThree',
  execute: async ({ context }) => {
    const stepTwoResult = context.machineContext?.stepResults.stepOne.result;
    const isEven = stepTwoResult.incrementedValue % 2 === 0;
    return { isEven };
  },
});

const stepFour = new Step({
  id: 'stepFour',
  execute: async ({ context }) => {
    const stepThreeResult = context.machineContext?.stepResults.stepThree.result;
    const isEven = stepThreeResult.tripledValue % 2 === 0;
    return { isEven };
  },
});

// Build the workflow
const myWorkflow = new Workflow({
  name: 'my-workflow',
  triggerSchema: z.object({
    inputValue: z.number(),
  }),
});

myWorkflow.step(stepOne).then(stepTwo).after(stepOne).step(stepThree).then(stepFour).commit();

const result = await myWorkflow.execute({ triggerData: { inputValue: 3 } });
