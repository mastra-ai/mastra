import { Step, Workflow } from '@mastra/core';
import { z } from 'zod';

const myWorkflow = new Workflow({
  name: 'my-workflow',
  triggerSchema: z.object({
    inputValue: z.number(),
  }),
});

myWorkflow.step(
  new Step({
    id: 'stepOne',
    inputSchema: z.object({
      value: z.number(),
    }),
    outputSchema: z.object({
      doubledValue: z.number(),
    }),
    execute: async ({ context }) => {
      const doubledValue = context.machineContext?.triggerData?.inputValue * 2;
      return { doubledValue };
    },
  }),
);

myWorkflow.commit();
const res = await myWorkflow.execute({ triggerData: { inputValue: 90 } });

console.log(res.results);
