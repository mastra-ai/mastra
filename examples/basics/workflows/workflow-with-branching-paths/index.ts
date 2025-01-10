import { Workflow, Step } from '@mastra/core';
import { z } from 'zod';

async function main() {
  const doubleValue = new Step({
    id: 'doubleValue',
    description: 'Doubles the input value',
    outputSchema: z.object({
      doubledValue: z.number(),
    }),
    execute: async ({ context }) => {
      const inputValue = context?.machineContext?.getStepPayload<{ firstValue: number }>('trigger')?.firstValue;
      if (!inputValue) throw new Error('No input value provided');
      const doubledValue = inputValue * 2;
      return { doubledValue };
    },
  });

  const incrementByOne = new Step({
    id: 'incrementByOne',
    description: 'Adds 1 to the input value',
    outputSchema: z.object({
      incrementedValue: z.number(),
    }),
    execute: async ({ context }) => {
      const valueToIncrement = context?.machineContext?.getStepPayload<{ doubledValue: number }>(
        'doubleValue',
      )?.doubledValue;
      if (!valueToIncrement) throw new Error('No value to increment provided');
      const incrementedValue = valueToIncrement + 1;
      return { incrementedValue };
    },
  });

  const squareValue = new Step({
    id: 'squareValue',
    description: 'Squares the input value',
    outputSchema: z.object({
      squaredValue: z.number(),
    }),
    execute: async ({ context }) => {
      const valueToSquare = context?.machineContext?.getStepPayload<{ doubledValue: number }>(
        'doubleValue',
      )?.doubledValue;
      if (!valueToSquare) throw new Error('No value to square provided');
      const squaredValue = valueToSquare * valueToSquare;
      return { squaredValue };
    },
  });

  const branchedWorkflow = new Workflow({
    name: 'branched-workflow',
    triggerSchema: z.object({
      firstValue: z.number(),
    }),
  });

  branchedWorkflow.step(doubleValue).then(incrementByOne).after(doubleValue).step(squareValue).commit();

  const { runId, start } = branchedWorkflow.createRun();

  console.log('Run', runId);

  const res = await start({ triggerData: { firstValue: 20 } });

  console.log(res.results);
}

main();
