import type { Mastra } from '@mastra/core/mastra';

import { SCHEDULE_DEFAULTS } from '../config';
import type { MonitorInput } from '../schemas';
import type { MonitorStore } from './store';

const WORKFLOW_ID = 'competitor-monitor';

/** Optional programmatic setup; configured monitors use declarative schedules at boot. */
export async function ensureDailyMonitorSchedule(
  mastra: Mastra,
  input: MonitorInput,
  scheduleId = `${input.monitorId}-daily`,
) {
  const existing = (await mastra.schedules.list({ workflowId: WORKFLOW_ID })).find(
    schedule => schedule.metadata?.monitorId === input.monitorId,
  );
  const requested = { ...input, runMode: 'scheduled' as const };
  if (!existing) {
    return mastra.schedules.create({
      id: scheduleId,
      workflowId: WORKFLOW_ID,
      cron: SCHEDULE_DEFAULTS.cron,
      timezone: SCHEDULE_DEFAULTS.timezone,
      inputData: requested,
      metadata: { monitorId: input.monitorId },
    });
  }
  if (existing.workflowId !== WORKFLOW_ID) throw new Error('SCHEDULE_TARGET_CONFLICT');
  return mastra.schedules.update(existing.id, {
    cron: SCHEDULE_DEFAULTS.cron,
    timezone: SCHEDULE_DEFAULTS.timezone,
    inputData: requested,
    metadata: { monitorId: input.monitorId },
  });
}

/** Read only native trigger values. A scheduled time is never synthesized from local wall clock. */
export async function nativeScheduleHistory(mastra: Mastra, scheduleId: string) {
  const schedulesStore = await mastra.getStorage()?.getStore('schedules');
  if (!schedulesStore) throw new Error('SCHEDULES_NO_SCHEDULES_STORAGE');
  return schedulesStore.listTriggers(scheduleId);
}

/** Native trigger history enriched by the durable domain run mapping, with no shadow occurrence table. */
export async function monitorScheduleHistory(mastra: Mastra, store: MonitorStore, scheduleId: string) {
  const triggers = await nativeScheduleHistory(mastra, scheduleId);
  return Promise.all(
    triggers.map(async trigger => ({
      runId: trigger.runId,
      scheduledFireAt: trigger.scheduledFireAt,
      domainRun: trigger.runId ? await store.runForNativeWorkflowRunId(trigger.runId) : undefined,
    })),
  );
}
