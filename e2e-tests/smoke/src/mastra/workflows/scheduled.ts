import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';

const heartbeat = createStep({
  id: 'heartbeat',
  inputSchema: z.object({ source: z.string().default('scheduler') }),
  outputSchema: z.object({ ok: z.literal(true), source: z.string(), at: z.string() }),
  execute: async ({ inputData }) => {
    return { ok: true as const, source: inputData.source, at: new Date().toISOString() };
  },
});

/**
 * A workflow with a declarative `schedule` so the scheduler registers a row
 * the moment Mastra boots. We use a far-future cron (Jan 1 yearly) so the
 * schedule is visible to /api/schedules with a stable, non-noisy cadence.
 */
export const scheduledHeartbeatWorkflow = createWorkflow({
  id: 'scheduled-heartbeat',
  inputSchema: z.object({ source: z.string().default('scheduler') }),
  outputSchema: z.object({ ok: z.literal(true), source: z.string(), at: z.string() }),
  schedule: {
    id: 'smoke-heartbeat',
    cron: '0 0 1 1 *', // 00:00 on Jan 1 every year
    inputData: { source: 'smoke-scheduler' },
    metadata: { purpose: 'smoke-test-schedule' },
  },
})
  .then(heartbeat)
  .commit();

/**
 * A second scheduled workflow used to assert the scheduler actually publishes
 * triggers and the workflow actually runs end-to-end (not just that the
 * schedule row exists). Fires every 5 seconds (6-part cron) — paired with
 * the 5s scheduler tick this still proves end-to-end firing well within the
 * 15s poll budget in schedules.test.ts, but stops starving the LibSQL
 * workflow-snapshot table on slow CI disks.
 */
export const scheduledTickWorkflow = createWorkflow({
  id: 'scheduled-tick',
  inputSchema: z.object({ source: z.string().default('scheduler') }),
  outputSchema: z.object({ ok: z.literal(true), source: z.string(), at: z.string() }),
  schedule: {
    id: 'smoke-tick',
    cron: '*/5 * * * * *', // every 5 seconds
    inputData: { source: 'smoke-tick' },
    metadata: { purpose: 'smoke-test-trigger' },
  },
})
  .then(heartbeat)
  .commit();
