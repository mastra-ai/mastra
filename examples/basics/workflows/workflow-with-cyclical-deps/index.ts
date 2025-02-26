import { Step, Workflow } from '@mastra/core';
import { z } from 'zod';

async function main() {
  const doubleValue = new Step({
    id: 'doubleValue',
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
    id: 'incrementByOne',
    description: 'Adds 1 to the input value',
    outputSchema: z.object({
      incrementedValue: z.number(),
    }),
    execute: async ({ context }) => {
      const valueToIncrement = context?.getStepResult<{ firstValue: number }>('trigger')?.firstValue;
      if (!valueToIncrement) throw new Error('No value to increment provided');
      const incrementedValue = valueToIncrement + 1;
      return { incrementedValue };
    },
  });

  const cyclicalWorkflow = new Workflow({
    name: 'cyclical-workflow',
    triggerSchema: z.object({
      firstValue: z.number(),
    }),
  });

  cyclicalWorkflow
    .step(doubleValue, {
      variables: {
        inputValue: {
          step: 'trigger',
          path: 'firstValue',
        },
      },
    })
    .then(incrementByOne)
    .after(doubleValue)
    .step(doubleValue, {
      variables: {
        inputValue: {
          step: doubleValue,
          path: 'doubledValue',
        },
      },
    })
    .commit();

  const { runId, start } = cyclicalWorkflow.createRun();

  console.log('Run', runId);

  const res = await start({ triggerData: { firstValue: 6 } });

  console.log(res.results);
}

main();
