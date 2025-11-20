import { Step, Workflow } from '@mastra/core/workflows';
import { z } from 'zod';

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
      execute: async (inputData, context) => {
        const doubledValue = context?.workflow?.state?.triggerData.inputValue * 2;
        return { doubledValue };
      },
    }),
  )
  .then(
    new Step({
      id: 'stepTwo',
      inputSchema: z.object({
        valueToIncrement: z.number(),
      }),
      outputSchema: z.object({
        incrementedValue: z.number(),
      }),
      execute: async (inputData, context) => {
        const incrementedValue = inputData.valueToIncrement + 1;
        return { incrementedValue };
      },
    }),
  )
  .then(
    new Step({
      id: 'stepThree',
      execute: async (inputData, context) => {
        if (context?.workflow?.resumeData?.confirm !== 'true') {
          return context?.workflow?.suspend({
            message: 'Do you accept?',
          });
        }

        return {
          message: 'Thank you for accepting',
        };
      },
    }),
  );

myWorkflow.commit();

export { myWorkflow };
