import type { Mastra } from '@mastra/core';
import { computeNextFireAt } from '@mastra/core/workflows';
import type { WorkflowRunState } from '@mastra/core/workflows';
import { HTTPException } from '../http-exception';
import {
  listSchedulesQuerySchema,
  listSchedulesResponseSchema,
  scheduleIdPathParams,
  scheduleResponseSchema,
  listScheduleTriggersQuerySchema,
  listScheduleTriggersResponseSchema,
} from '../schemas/schedules';
import { createRoute } from '../server-adapter/routes/route-builder';

type RunSummary = {
  status: WorkflowRunState['status'];
  startedAt?: number;
  completedAt?: number;
  durationMs?: number;
  error?: string;
};

function snapshotToRunSummary(run: {
  snapshot: WorkflowRunState | string;
  createdAt: Date;
  updatedAt: Date;
}): RunSummary | undefined {
  const snapshot = typeof run.snapshot === 'string' ? null : run.snapshot;
  if (!snapshot) return undefined;
  const startedAt = run.createdAt instanceof Date ? run.createdAt.getTime() : undefined;
  const isTerminal =
    snapshot.status === 'success' ||
    snapshot.status === 'failed' ||
    snapshot.status === 'canceled' ||
    snapshot.status === 'bailed' ||
    snapshot.status === 'tripwire';
  const completedAt = isTerminal ? (run.updatedAt instanceof Date ? run.updatedAt.getTime() : undefined) : undefined;
  const durationMs = startedAt !== undefined && completedAt !== undefined ? completedAt - startedAt : undefined;
  return {
    status: snapshot.status,
    startedAt,
    completedAt,
    durationMs,
    error: snapshot.error?.message,
  };
}

async function fetchRunSummary(mastra: Mastra, workflowName: string, runId: string): Promise<RunSummary | undefined> {
  try {
    const workflowsStore = await mastra.getStorage()?.getStore('workflows');
    const run = await workflowsStore?.getWorkflowRunById({ runId, workflowName });
    if (!run) return undefined;
    return snapshotToRunSummary(run);
  } catch {
    return undefined;
  }
}

async function hydrateScheduleResponse<T extends { lastRunId?: string; target: { type: string; workflowId?: string } }>(
  mastra: Mastra,
  schedule: T,
): Promise<T & { lastRun?: RunSummary }> {
  if (!schedule.lastRunId || schedule.target.type !== 'workflow' || !schedule.target.workflowId) {
    return schedule;
  }
  const lastRun = await fetchRunSummary(mastra, schedule.target.workflowId, schedule.lastRunId);
  return lastRun ? { ...schedule, lastRun } : schedule;
}

export const LIST_SCHEDULES_ROUTE = createRoute({
  method: 'GET',
  path: '/schedules',
  responseType: 'json' as const,
  queryParamSchema: listSchedulesQuerySchema,
  responseSchema: listSchedulesResponseSchema,
  summary: 'List workflow schedules',
  description: 'Returns the configured schedules, optionally filtered by workflowId or status.',
  tags: ['Schedules'],
  requiresAuth: true,
  handler: async ({ mastra, workflowId, status }) => {
    const schedulesStore = await mastra.getStorage()?.getStore('schedules');
    if (!schedulesStore) {
      // Schedules domain not configured — there are no schedules to return.
      return { schedules: [] };
    }
    const schedules = await schedulesStore.listSchedules({ workflowId, status });
    const hydrated = await Promise.all(
      schedules.map(async schedule => {
        if (!schedule.lastRunId || schedule.target.type !== 'workflow') {
          return schedule;
        }
        const lastRun = await fetchRunSummary(mastra, schedule.target.workflowId, schedule.lastRunId);
        return lastRun ? { ...schedule, lastRun } : schedule;
      }),
    );
    return { schedules: hydrated };
  },
});

export const GET_SCHEDULE_ROUTE = createRoute({
  method: 'GET',
  path: '/schedules/:scheduleId',
  responseType: 'json' as const,
  pathParamSchema: scheduleIdPathParams,
  responseSchema: scheduleResponseSchema,
  summary: 'Get a workflow schedule by ID',
  description: 'Returns a single schedule row by its storage id.',
  tags: ['Schedules'],
  requiresAuth: true,
  handler: async ({ mastra, scheduleId }) => {
    const schedulesStore = await mastra.getStorage()?.getStore('schedules');
    if (!schedulesStore) {
      throw new HTTPException(404, { message: 'Schedule not found' });
    }
    const schedule = await schedulesStore.getSchedule(scheduleId);
    if (!schedule) {
      throw new HTTPException(404, { message: 'Schedule not found' });
    }
    return hydrateScheduleResponse(mastra, schedule);
  },
});

export const LIST_SCHEDULE_TRIGGERS_ROUTE = createRoute({
  method: 'GET',
  path: '/schedules/:scheduleId/triggers',
  responseType: 'json' as const,
  pathParamSchema: scheduleIdPathParams,
  queryParamSchema: listScheduleTriggersQuerySchema,
  responseSchema: listScheduleTriggersResponseSchema,
  summary: 'List trigger history for a schedule',
  description: 'Returns the audit trail of trigger attempts for a schedule, ordered by actualFireAt descending.',
  tags: ['Schedules'],
  requiresAuth: true,
  handler: async ({ mastra, scheduleId, limit, fromActualFireAt, toActualFireAt }) => {
    const schedulesStore = await mastra.getStorage()?.getStore('schedules');
    if (!schedulesStore) {
      return { triggers: [] };
    }
    const schedule = await schedulesStore.getSchedule(scheduleId);
    const triggers = await schedulesStore.listTriggers(scheduleId, { limit, fromActualFireAt, toActualFireAt });
    if (!schedule || schedule.target.type !== 'workflow') {
      return { triggers };
    }
    const workflowName = schedule.target.workflowId;
    const hydrated = await Promise.all(
      triggers.map(async trigger => {
        if (trigger.status !== 'published' || !trigger.runId) return trigger;
        const run = await fetchRunSummary(mastra, workflowName, trigger.runId);
        return run ? { ...trigger, run } : trigger;
      }),
    );
    return { triggers: hydrated };
  },
});

export const PAUSE_SCHEDULE_ROUTE = createRoute({
  method: 'POST',
  path: '/schedules/:scheduleId/pause',
  responseType: 'json' as const,
  pathParamSchema: scheduleIdPathParams,
  responseSchema: scheduleResponseSchema,
  summary: 'Pause a workflow schedule',
  description:
    'Marks the schedule as paused. The scheduler tick loop will skip paused schedules. Idempotent — pausing an already-paused schedule returns the current state unchanged. Pause status survives redeploys.',
  tags: ['Schedules'],
  requiresAuth: true,
  handler: async ({ mastra, scheduleId }) => {
    const schedulesStore = await mastra.getStorage()?.getStore('schedules');
    if (!schedulesStore) {
      throw new HTTPException(404, { message: 'Schedule not found' });
    }
    const existing = await schedulesStore.getSchedule(scheduleId);
    if (!existing) {
      throw new HTTPException(404, { message: 'Schedule not found' });
    }
    if (existing.status === 'paused') {
      return hydrateScheduleResponse(mastra, existing);
    }
    const updated = await schedulesStore.updateSchedule(scheduleId, { status: 'paused' });
    return hydrateScheduleResponse(mastra, updated);
  },
});

export const RESUME_SCHEDULE_ROUTE = createRoute({
  method: 'POST',
  path: '/schedules/:scheduleId/resume',
  responseType: 'json' as const,
  pathParamSchema: scheduleIdPathParams,
  responseSchema: scheduleResponseSchema,
  summary: 'Resume a paused workflow schedule',
  description:
    'Marks the schedule as active and recomputes nextFireAt from "now" so a long-paused schedule does not fire a backlog. Idempotent — resuming an already-active schedule returns the current state unchanged.',
  tags: ['Schedules'],
  requiresAuth: true,
  handler: async ({ mastra, scheduleId }) => {
    const schedulesStore = await mastra.getStorage()?.getStore('schedules');
    if (!schedulesStore) {
      throw new HTTPException(404, { message: 'Schedule not found' });
    }
    const existing = await schedulesStore.getSchedule(scheduleId);
    if (!existing) {
      throw new HTTPException(404, { message: 'Schedule not found' });
    }
    if (existing.status === 'active') {
      return hydrateScheduleResponse(mastra, existing);
    }
    const nextFireAt = computeNextFireAt(existing.cron, {
      timezone: existing.timezone,
      after: Date.now(),
    });
    const updated = await schedulesStore.updateSchedule(scheduleId, { status: 'active', nextFireAt });
    return hydrateScheduleResponse(mastra, updated);
  },
});
