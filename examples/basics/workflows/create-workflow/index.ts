import { Step, Workflow } from '@mastra/core';
import { z } from 'zod';

async function main() {
  const myWorkflow = new Workflow({
    name: 'my-workflow',
    triggerSchema: z.object({
      inputValue: z.number(),
    }),
  });

  myWorkflow
    .step(
      new Step({
        id: 'stepOne',
        inputSchema: z.object({
          value: z.number(),
        }),
        outputSchema: z.object({
          doubledValue: z.number(),
        }),
        execute: async ({ context }) => {
          const doubledValue = context?.triggerData?.inputValue * 2;
          return { doubledValue };
        },
      }),
    )
    .commit();

  const { runId, start } = myWorkflow.createRun();

  console.log('Run', runId);

  const res = await start({ triggerData: { inputValue: 90 } });

  console.log(res.results);
}

main();
