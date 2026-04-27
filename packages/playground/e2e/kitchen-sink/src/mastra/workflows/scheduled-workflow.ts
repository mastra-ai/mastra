import { createWorkflow, createStep } from '@mastra/core/workflows/evented';
import { z } from 'zod';

const echoStep = createStep({
  id: 'echo',
  inputSchema: z.object({ message: z.string() }),
  outputSchema: z.object({ message: z.string() }),
  execute: async ({ inputData }) => ({ message: inputData.message }),
});

export const scheduledWorkflow = createWorkflow({
  id: 'scheduledWorkflow',
  inputSchema: z.object({ message: z.string() }),
  outputSchema: z.object({ message: z.string() }),
  schedule: {
    cron: '0 9 * * *',
    timezone: 'America/New_York',
    inputData: { message: 'hello from cron' },
  },
})
  .then(echoStep)
  .commit();

export const multiScheduledWorkflow = createWorkflow({
  id: 'multiScheduledWorkflow',
  inputSchema: z.object({ message: z.string() }),
  outputSchema: z.object({ message: z.string() }),
  schedule: [
    {
      id: 'morning',
      cron: '0 8 * * *',
      timezone: 'UTC',
      inputData: { message: 'morning run' },
    },
    {
      id: 'evening',
      cron: '0 20 * * *',
      timezone: 'UTC',
      inputData: { message: 'evening run' },
    },
  ],
})
  .then(echoStep)
  .commit();
