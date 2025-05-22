import { LegacyStep, LegacyWorkflow } from '@mastra/core/workflows/legacy';
import { z } from 'zod';

async function main() {
  const myWorkflow = new LegacyWorkflow({
    name: 'my-workflow',
    triggerSchema: z.object({
      inputValue: z.number(),
    }),
  });

  myWorkflow
    .step(
      new LegacyStep({
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
