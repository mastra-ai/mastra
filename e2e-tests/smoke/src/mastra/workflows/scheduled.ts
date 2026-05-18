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
 * the moment Mastra boots. We use a far-future cron (Feb 31 — never fires) so
 * the schedule is visible to /api/schedules without actually executing during
 * smoke runs.
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
