import type { Mastra } from '@mastra/core';
import type { AgentSchedule, AnySchedule, WorkflowSchedule } from '@mastra/core/schedules';
import type { WorkflowRunState } from '@mastra/core/workflows';
import { HTTPException } from '../http-exception';
import {
  createScheduleBodySchema,
  deleteScheduleResponseSchema,
  listSchedulesQuerySchema,
  listSchedulesResponseSchema,
  listScheduleTriggersQuerySchema,
  listScheduleTriggersResponseSchema,
  runScheduleResponseSchema,
  scheduleIdPathParams,
  scheduleSchema,
  updateScheduleBodySchema,
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

/**
 * Attach a `lastRun` summary to workflow schedules. Agent schedules pass
 * through unchanged — their `lastRunId` is an agent run, not a workflow run.
 */
async function hydrateScheduleResponse(
  mastra: Mastra,
  schedule: AnySchedule,
): Promise<AgentSchedule | (WorkflowSchedule & { lastRun?: RunSummary })> {
  if (!schedule.workflowId || !schedule.lastRunId) {
    return schedule;
  }
  const lastRun = await fetchRunSummary(mastra, schedule.workflowId, schedule.lastRunId);
  return lastRun ? { ...schedule, lastRun } : schedule;
}

/**
 * Resolve a schedule by id via `mastra.schedules`. Returns 404 for missing
 * rows so handlers surface a clean HTTP error instead of a service error.
 */
async function loadSchedule(mastra: Mastra, scheduleId: string): Promise<AnySchedule> {
  const schedule = await mastra.schedules.get(scheduleId);
  if (!schedule) {
    throw new HTTPException(404, { message: 'Schedule not found' });
  }
  return schedule;
}

export const LIST_SCHEDULES_ROUTE = createRoute({
  method: 'GET',
  path: '/schedules',
  responseType: 'json' as const,
  queryParamSchema: listSchedulesQuerySchema,
  responseSchema: listSchedulesResponseSchema,
  summary: 'List schedules',
  description:
    'Returns all schedules — agent schedules and workflow schedules — optionally filtered by agentId, workflowId, or status. Agent schedules can additionally be filtered by threadId, resourceId, or name.',
  tags: ['Schedules'],
  requiresAuth: true,
  handler: async ({ mastra, agentId, workflowId, status, threadId, resourceId, name }) => {
    const schedulesStore = await mastra.getStorage()?.getStore('schedules');
    if (!schedulesStore) {
      // Schedules domain not configured — there are no schedules to return.
      return { schedules: [] };
    }
    const schedules = await mastra.schedules.list({ agentId, workflowId, status, threadId, resourceId, name });
    const hydrated = await Promise.all(schedules.map(schedule => hydrateScheduleResponse(mastra, schedule)));
    return { schedules: hydrated };
  },
});

export const GET_SCHEDULE_ROUTE = createRoute({
  method: 'GET',
  path: '/schedules/:scheduleId',
  responseType: 'json' as const,
  pathParamSchema: scheduleIdPathParams,
  responseSchema: scheduleSchema,
  summary: 'Get a schedule by ID',
  description: 'Returns a single schedule by its id.',
  tags: ['Schedules'],
  requiresAuth: true,
  handler: async ({ mastra, scheduleId }) => {
    const schedule = await loadSchedule(mastra, scheduleId);
    return hydrateScheduleResponse(mastra, schedule);
  },
});

export const CREATE_SCHEDULE_ROUTE = createRoute({
  method: 'POST',
  path: '/schedules',
  responseType: 'json' as const,
  bodySchema: createScheduleBodySchema,
  responseSchema: scheduleSchema,
  summary: 'Create a schedule',
  description:
    'Creates a new schedule. Pass `agentId` (plus `prompt`) to schedule an agent, or `workflowId` (plus optional `inputData`) to schedule a workflow. Agent schedules get a random `agent_<uuid>` id, workflow schedules a random `schedule_<uuid>` id; pass `id` for a stable slug instead.',
  tags: ['Schedules'],
  requiresAuth: true,
  handler: async ({ mastra, ...body }) => {
    // getAgentById / getWorkflowById throw a MastraError (status 404) when the
    // target is unknown; translate that into a clean HTTP 404 instead of
    // letting it surface as 500.
    if ('workflowId' in body && body.workflowId) {
      try {
        mastra.getWorkflowById(body.workflowId);
      } catch {
        throw new HTTPException(404, { message: `Workflow "${body.workflowId}" not found` });
      }
      return await mastra.schedules.create({
        workflowId: body.workflowId,
        cron: body.cron,
        ...(body.id ? { id: body.id } : {}),
        ...(body.timezone ? { timezone: body.timezone } : {}),
        ...(body.inputData !== undefined ? { inputData: body.inputData } : {}),
        ...(body.initialState !== undefined ? { initialState: body.initialState } : {}),
        ...(body.requestContext ? { requestContext: body.requestContext } : {}),
        ...(body.metadata ? { metadata: body.metadata } : {}),
      });
    }
    const agentBody = body as Extract<typeof body, { agentId: string }>;
    try {
      mastra.getAgentById(agentBody.agentId);
    } catch {
      throw new HTTPException(404, { message: `Agent "${agentBody.agentId}" not found` });
    }
    return await mastra.schedules.create({
      agentId: agentBody.agentId,
      cron: agentBody.cron,
      prompt: agentBody.prompt,
      ...(agentBody.id ? { id: agentBody.id } : {}),
      ...(agentBody.name ? { name: agentBody.name } : {}),
      ...(agentBody.timezone ? { timezone: agentBody.timezone } : {}),
      ...(agentBody.threadId ? { threadId: agentBody.threadId } : {}),
      ...(agentBody.resourceId ? { resourceId: agentBody.resourceId } : {}),
      ...(agentBody.signalType ? { signalType: agentBody.signalType } : {}),
      ...(agentBody.tagName ? { tagName: agentBody.tagName } : {}),
      ...(agentBody.attributes ? { attributes: agentBody.attributes } : {}),
      ...(agentBody.ifActive ? { ifActive: agentBody.ifActive } : {}),
      ...(agentBody.ifIdle ? { ifIdle: agentBody.ifIdle } : {}),
      ...(agentBody.providerOptions ? { providerOptions: agentBody.providerOptions } : {}),
      ...(agentBody.metadata ? { metadata: agentBody.metadata } : {}),
    });
  },
});

export const UPDATE_SCHEDULE_ROUTE = createRoute({
  method: 'PATCH',
  path: '/schedules/:scheduleId',
  responseType: 'json' as const,
  pathParamSchema: scheduleIdPathParams,
  bodySchema: updateScheduleBodySchema,
  responseSchema: scheduleSchema,
  summary: 'Update a schedule',
  description:
    'Partial update of a schedule. Fields apply to the matching target type; agent-only fields on a workflow schedule are rejected. `threadId` and `resourceId` are part of an agent schedule identity and cannot be changed — to re-target, delete and recreate. Editing `cron` (or `timezone`) recomputes `nextFireAt`.',
  tags: ['Schedules'],
  requiresAuth: true,
  handler: async ({ mastra, scheduleId, ...body }) => {
    await loadSchedule(mastra, scheduleId);
    return await mastra.schedules.update(scheduleId, {
      ...(body.cron !== undefined ? { cron: body.cron } : {}),
      ...(body.timezone !== undefined ? { timezone: body.timezone } : {}),
      ...(body.status !== undefined ? { status: body.status } : {}),
      ...(body.metadata !== undefined ? { metadata: body.metadata } : {}),
      ...(body.prompt !== undefined ? { prompt: body.prompt } : {}),
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.signalType !== undefined ? { signalType: body.signalType } : {}),
      ...(body.tagName !== undefined ? { tagName: body.tagName } : {}),
      ...(body.attributes !== undefined ? { attributes: body.attributes } : {}),
      ...(body.ifActive !== undefined ? { ifActive: body.ifActive } : {}),
      ...(body.ifIdle !== undefined ? { ifIdle: body.ifIdle } : {}),
      ...(body.providerOptions !== undefined ? { providerOptions: body.providerOptions } : {}),
      ...(body.inputData !== undefined ? { inputData: body.inputData } : {}),
      ...(body.initialState !== undefined ? { initialState: body.initialState } : {}),
      ...(body.requestContext !== undefined ? { requestContext: body.requestContext } : {}),
    });
  },
});

export const DELETE_SCHEDULE_ROUTE = createRoute({
  method: 'DELETE',
  path: '/schedules/:scheduleId',
  responseType: 'json' as const,
  pathParamSchema: scheduleIdPathParams,
  responseSchema: deleteScheduleResponseSchema,
  summary: 'Delete a schedule',
  description: 'Permanently deletes the schedule. 404 when the schedule does not exist.',
  tags: ['Schedules'],
  requiresAuth: true,
  handler: async ({ mastra, scheduleId }) => {
    await loadSchedule(mastra, scheduleId);
    await mastra.schedules.delete(scheduleId);
    return { message: 'Schedule deleted' };
  },
});

export const PAUSE_SCHEDULE_ROUTE = createRoute({
  method: 'POST',
  path: '/schedules/:scheduleId/pause',
  responseType: 'json' as const,
  pathParamSchema: scheduleIdPathParams,
  responseSchema: scheduleSchema,
  summary: 'Pause a schedule',
  description:
    'Marks the schedule as paused. The scheduler tick loop will skip paused schedules. Idempotent — pausing an already-paused schedule returns the current state unchanged. Pause status survives redeploys.',
  tags: ['Schedules'],
  requiresAuth: true,
  handler: async ({ mastra, scheduleId }) => {
    await loadSchedule(mastra, scheduleId);
    const updated = await mastra.schedules.pause(scheduleId);
    return hydrateScheduleResponse(mastra, updated);
  },
});

export const RESUME_SCHEDULE_ROUTE = createRoute({
  method: 'POST',
  path: '/schedules/:scheduleId/resume',
  responseType: 'json' as const,
  pathParamSchema: scheduleIdPathParams,
  responseSchema: scheduleSchema,
  summary: 'Resume a paused schedule',
  description:
    'Marks the schedule as active and recomputes nextFireAt from "now" so a long-paused schedule does not fire a backlog. Idempotent — resuming an already-active schedule returns the current state unchanged.',
  tags: ['Schedules'],
  requiresAuth: true,
  handler: async ({ mastra, scheduleId }) => {
    await loadSchedule(mastra, scheduleId);
    const updated = await mastra.schedules.resume(scheduleId);
    return hydrateScheduleResponse(mastra, updated);
  },
});

export const RUN_SCHEDULE_ROUTE = createRoute({
  method: 'POST',
  path: '/schedules/:scheduleId/run',
  responseType: 'json' as const,
  pathParamSchema: scheduleIdPathParams,
  responseSchema: runScheduleResponseSchema,
  summary: 'Fire a schedule now',
  description:
    'Manually triggers a single schedule fire out-of-band from the cron schedule. Records a trigger row with `triggerKind: "manual"`. Does not advance `nextFireAt`.',
  tags: ['Schedules'],
  requiresAuth: true,
  handler: async ({ mastra, scheduleId }) => {
    await loadSchedule(mastra, scheduleId);
    return await mastra.schedules.run(scheduleId);
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
    const schedule = await mastra.schedules.get(scheduleId);
    const triggers = await schedulesStore.listTriggers(schedule?.id ?? scheduleId, {
      limit,
      fromActualFireAt,
      toActualFireAt,
    });
    if (!schedule?.workflowId) {
      return { triggers };
    }
    const workflowName = (schedule as WorkflowSchedule).workflowId;
    const hydrated = await Promise.all(
      triggers.map(async trigger => {
        if (trigger.outcome !== 'published' || !trigger.runId) return trigger;
        const run = await fetchRunSummary(mastra, workflowName, trigger.runId);
        return run ? { ...trigger, run } : trigger;
      }),
    );
    return { triggers: hydrated };
  },
});
