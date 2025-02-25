import { Step, Workflow } from '@mastra/core';
import { z } from 'zod';

async function main() {
  const stepOne = new Step({
    id: 'stepOne',
    inputSchema: z.object({
      inputValue: z.number(),
    }),
    outputSchema: z.object({
      doubledValue: z.number(),
    }),
    execute: async ({ context }) => {
      const inputValue = context?.getStepResult<{ inputValue: number }>('trigger')?.inputValue;
      if (!inputValue) throw new Error('No input value provided');
      const doubledValue = inputValue * 2;
      return { doubledValue };
    },
  });

  const stepTwo = new Step({
    id: 'stepTwo',
    inputSchema: z.object({
      valueToIncrement: z.number(),
    }),
    outputSchema: z.object({
      incrementedValue: z.number(),
    }),
    execute: async ({ context }) => {
      const valueToIncrement = context?.getStepResult<{ doubledValue: number }>('stepOne')?.doubledValue;
      if (!valueToIncrement) throw new Error('No value to increment provided');
      const incrementedValue = valueToIncrement + 1;
      return { incrementedValue };
    },
  });

  // Build the workflow
  const myWorkflow = new Workflow({
    name: 'my-workflow',
    triggerSchema: z.object({
      inputValue: z.number(),
    }),
  });

  // sequential steps
  myWorkflow.step(stepOne).then(stepTwo);

  myWorkflow.commit();

  const { runId, start } = myWorkflow.createRun();

  console.log('Run', runId);

  const res = await start({ triggerData: { inputValue: 90 } });

  console.log(res.results);
}

main();
