import { Workflow, Step } from '@mastra/core';
import { z } from 'zod';

const logCatName = new Step({
  id: 'logCatName',
  outputSchema: z.object({
    rawText: z.string(),
  }),
  execute: async ({ context, suspend }) => {
    const hasOutput = context.getStepResult('logCatName');
    if (!hasOutput) {
      console.log('suspending', hasOutput);
      await suspend();
    }

    const name = context?.getStepResult<{ name: string }>('trigger')?.name;
    console.log(`Hello, ${name} 🐈`);
    return { rawText: `Hello ${name}` };
  },
});

const finalStep = new Step({
  id: 'finalStep',
  execute: async ({ context }) => {
    console.log('final step');
  },
});

export const logCatWorkflow = new Workflow({
  name: 'log-cat-workflow',
  triggerSchema: z.object({
    name: z.string(),
  }),
  events: {
    'cat-event': {
      schema: z.object({
        catName: z.string(),
      }),
    },
  },
});

const lol2 = new Step({
  id: 'lol2',
  execute: async ({ suspend }) => {
    console.log('lol');
    // await suspend();
  },
});

// logCatWorkflow.step(logCatName).afterEvent('cat-event').step(finalStep).commit();
logCatWorkflow
  .step(logCatName)
  .then(lol2)
  .after(lol2)
  .step(
    new Step({
      id: 'lol',
      execute: async ({ suspend }) => {
        console.log('lol');
        // await suspend();
      },
    }),
  )
  .then(
    new Step({
      id: 'suspendStep',
      execute: async ({ context, suspend }) => {
        const hasOutput = context.getStepResult('suspendStep');
        console.log('suspending', hasOutput);
        if (!hasOutput) {
          // await suspend();
        }
      },
    }),
  )
  .then(finalStep)
  .commit();
