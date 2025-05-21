import { LegacyStep, LegacyWorkflow } from '@mastra/core/workflows/legacy';
import { z } from 'zod';

const stepOne = new LegacyStep({
  id: 'stepOne',
  execute: async ({ context }) => {
    const triggerData = context?.triggerData;
    const doubledValue = triggerData.inputValue * 2;
    return { doubledValue };
  },
});

const stepTwo = new LegacyStep({
  id: 'stepTwo',
  execute: async ({ context }) => {
    const stepOneResult = context?.getStepResult<{ doubledValue: number }>('stepOne');
    const incrementedValue = stepOneResult.doubledValue + 1;
    return { incrementedValue };
  },
});

const stepThree = new LegacyStep({
  id: 'stepThree',
  execute: async ({ context }) => {
    const stepTwoResult = context?.getStepResult<{ incrementedValue: number }>('stepTwo');
    const isEven = stepTwoResult.incrementedValue % 2 === 0;
    return { isEven };
  },
});

const stepFour = new LegacyStep({
  id: 'stepFour',
  execute: async ({ context }) => {
    const stepThreeResult = context?.getStepResult<{ tripledValue: number }>('stepThree');
    const isEven = stepThreeResult.tripledValue % 2 === 0;
    return { isEven };
  },
});

// Build the workflow
const myWorkflow = new LegacyWorkflow({
  name: 'my-workflow',
  triggerSchema: z.object({
    inputValue: z.number(),
  }),
});

myWorkflow.step(stepOne).then(stepTwo).after(stepOne).step(stepThree).then(stepFour).commit();

const { start } = myWorkflow.createRun();

const result = await start({ triggerData: { inputValue: 3 } });
