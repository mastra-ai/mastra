import { Step, Workflow } from '@mastra/core/workflows';
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
    const stepOneResult = context.machineContext?.stepResults.stepOne?.payload;
    const incrementedValue = stepOneResult.doubledValue + 1;
    return { incrementedValue };
  },
});

const stepThree = new Step({
  id: 'stepThree',
  execute: async ({ context }) => {
    const triggerData = context.machineContext?.triggerData;
    const tripledValue = triggerData.inputValue * 3;
    return { tripledValue };
  },
});

const stepFour = new Step({
  id: 'stepFour',
  execute: async ({ context }) => {
    const stepThreeResult = context.machineContext?.stepResults.stepThree?.payload;
    const isEven = stepThreeResult.tripledValue % 2 === 0;
    return { isEven };
  },
});

const myWorkflow = new Workflow({
  name: 'my-workflow',
  triggerSchema: z.object({
    inputValue: z.number(),
  }),
});

myWorkflow.step(stepOne).then(stepTwo).step(stepThree).then(stepFour).commit();

const { start } = myWorkflow.createRun();

const result = await start({ triggerData: { inputValue: 3 } });
