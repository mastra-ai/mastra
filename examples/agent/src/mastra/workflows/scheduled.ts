import { createWorkflow, createStep } from '@mastra/core/workflows/evented';
import { z } from 'zod';

/**
 * Demo workflows showcasing the new declarative `schedule` field on createWorkflow().
 *
 * Two forms:
 *  1. Single schedule object → produces 1 row (id `wf_<workflowId>`).
 *  2. Array of schedule entries → produces N rows (id `wf_<workflowId>__<entry.id>`).
 *
 * Each declared schedule shows up read-only in Studio at /workflows/schedules
 * (cross-workflow) and /workflows/<id>/schedules (per-workflow), with a trigger
 * audit trail accumulating each time the cron fires.
 *
 * The cron expressions below intentionally fire often (every minute / every 2
 * minutes) so the demo produces visible trigger history in seconds rather than
 * waiting until the next 9am.
 */

const greetStep = createStep({
  id: 'greet',
  inputSchema: z.object({ greeting: z.string() }),
  outputSchema: z.object({ greeting: z.string(), firedAt: z.string() }),
  execute: async ({ inputData }) => ({
    greeting: inputData.greeting,
    firedAt: new Date().toISOString(),
  }),
});

// Single-schedule form: fires every minute.
export const heartbeatWorkflow = createWorkflow({
  id: 'heartbeatWorkflow',
  description: 'Demo workflow that fires every minute on a declarative schedule.',
  inputSchema: z.object({ greeting: z.string() }),
  outputSchema: z.object({ greeting: z.string(), firedAt: z.string() }),
  schedule: {
    cron: '* * * * *',
    timezone: 'UTC',
    inputData: { greeting: 'tick' },
  },
})
  .then(greetStep)
  .commit();

// Array-schedule form: same workflow, two cadences with different payloads.
export const multiCadenceWorkflow = createWorkflow({
  id: 'multiCadenceWorkflow',
  description: 'Demo workflow with multiple declarative schedules (fast + slow).',
  inputSchema: z.object({ greeting: z.string() }),
  outputSchema: z.object({ greeting: z.string(), firedAt: z.string() }),
  schedule: [
    {
      id: 'fast',
      cron: '* * * * *',
      timezone: 'UTC',
      inputData: { greeting: 'fast cadence' },
    },
    {
      id: 'slow',
      cron: '*/2 * * * *',
      timezone: 'UTC',
      inputData: { greeting: 'slow cadence' },
    },
  ],
})
  .then(greetStep)
  .commit();
