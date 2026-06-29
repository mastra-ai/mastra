import { randomUUID } from 'node:crypto';
import type { Schedule, ScheduleTrigger } from '@mastra/core/storage';

/**
 * Creates a sample schedule for tests.
 */
export function createSampleSchedule(overrides?: Partial<Schedule>): Schedule {
  const now = Date.now();
  return {
    id: `sched_${randomUUID()}`,
    target: {
      type: 'workflow',
      workflowId: 'test-workflow',
      inputData: { query: 'test' },
    },
    cron: '*/10 * * * *',
    status: 'active',
    nextFireAt: now + 60_000,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

/**
 * Creates a sample schedule trigger record for tests.
 */
export function createSampleTrigger(overrides?: Partial<ScheduleTrigger>): ScheduleTrigger {
  const now = Date.now();
  return {
    id: `tr_${randomUUID()}`,
    scheduleId: 'sched_1',
    runId: `run_${randomUUID()}`,
    scheduledFireAt: now,
    actualFireAt: now,
    outcome: 'published',
    triggerKind: 'schedule-fire',
    ...overrides,
  };
}
