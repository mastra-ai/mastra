import type { Mastra } from '@mastra/core';
import type { Schedule } from '@mastra/core/storage';
import type { WorkflowRunState } from '@mastra/core/workflows';
import { HTTPException } from '../http-exception';
import {
  createHeartbeatBodySchema,
  deleteHeartbeatResponseSchema,
  heartbeatAgentPathParams,
  heartbeatPathParams,
  heartbeatSchema,
  listHeartbeatsQuerySchema,
  listHeartbeatsResponseSchema,
  listHeartbeatTriggersQuerySchema,
  listHeartbeatTriggersResponseSchema,
  updateHeartbeatBodySchema,
} from '../schemas/heartbeats';
import { createRoute } from '../server-adapter/routes/route-builder';
import { HEARTBEAT_SCHEDULE_PREFIX, HEARTBEAT_WORKFLOW_ID, HeartbeatInputSchema } from './heartbeats-core-shim';
import { computeNextFireAt, validateCron } from './schedules-workflows-shim';

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
 * Flat Heartbeat view returned to clients. Hides the underlying
 * `target.workflowId` / `target.inputData` shape so callers only see the
 * heartbeat surface — not the schedule + built-in workflow implementation.
 */
function scheduleToHeartbeat(schedule: Schedule): {
  id: string;
  agentId: string;
  threadId?: string;
  resourceId?: string;
  prompt: string;
  cron: string;
  timezone?: string;
  status: 'active' | 'paused';
  nextFireAt: number;
  lastFireAt?: number;
  lastRunId?: string;
  signalType?: string;
  ifActive?: 'deliver' | 'persist' | 'discard';
  ifIdle?: 'wake' | 'persist' | 'discard';
  activeHours?: { start: string; end: string; timezone?: string };
  idleThresholdMs?: number;
  metadata?: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
} | null {
  if (schedule.target?.type !== 'workflow' || schedule.target.workflowId !== HEARTBEAT_WORKFLOW_ID) {
    return null;
  }
  const parsed = HeartbeatInputSchema.safeParse(schedule.target.inputData);
  if (!parsed.success) return null;
  const input = parsed.data;
  return {
    id: schedule.id,
    agentId: input.agentId,
    ...(input.threadId ? { threadId: input.threadId } : {}),
    ...(input.resourceId ? { resourceId: input.resourceId } : {}),
    prompt: input.prompt,
    cron: schedule.cron,
    ...(schedule.timezone ? { timezone: schedule.timezone } : {}),
    status: schedule.status,
    nextFireAt: schedule.nextFireAt,
    ...(schedule.lastFireAt !== undefined ? { lastFireAt: schedule.lastFireAt } : {}),
    ...(schedule.lastRunId ? { lastRunId: schedule.lastRunId } : {}),
    ...(input.signalType ? { signalType: input.signalType } : {}),
    ...(input.ifActive ? { ifActive: input.ifActive } : {}),
    ...(input.ifIdle ? { ifIdle: input.ifIdle } : {}),
    ...(input.activeHours ? { activeHours: input.activeHours } : {}),
    ...(input.idleThresholdMs !== undefined ? { idleThresholdMs: input.idleThresholdMs } : {}),
    ...(schedule.metadata ? { metadata: schedule.metadata } : {}),
    createdAt: schedule.createdAt,
    updatedAt: schedule.updatedAt,
  };
}

async function hydrateHeartbeat<T extends ReturnType<typeof scheduleToHeartbeat>>(
  mastra: Mastra,
  heartbeat: NonNullable<T>,
): Promise<NonNullable<T> & { lastRun?: RunSummary }> {
  if (!heartbeat.lastRunId) return heartbeat;
  const lastRun = await fetchRunSummary(mastra, HEARTBEAT_WORKFLOW_ID, heartbeat.lastRunId);
  return lastRun ? { ...heartbeat, lastRun } : heartbeat;
}

/**
 * Resolve a heartbeat schedule row owned by `agentId` and return both the
 * schedule and the flat view. Throws 404 (not 403) when the schedule does
 * not exist OR exists but is owned by another agent — avoids leaking
 * cross-agent existence.
 */
async function loadOwnedHeartbeat(
  mastra: Mastra,
  agentId: string,
  heartbeatId: string,
): Promise<{ schedule: Schedule; heartbeat: NonNullable<ReturnType<typeof scheduleToHeartbeat>> }> {
  const schedulesStore = await mastra.getStorage()?.getStore('schedules');
  if (!schedulesStore) {
    throw new HTTPException(404, { message: 'Heartbeat not found' });
  }
  const schedule = await schedulesStore.getSchedule(heartbeatId);
  if (!schedule) {
    throw new HTTPException(404, { message: 'Heartbeat not found' });
  }
  if (schedule.ownerType !== 'agent' || schedule.ownerId !== agentId) {
    throw new HTTPException(404, { message: 'Heartbeat not found' });
  }
  const heartbeat = scheduleToHeartbeat(schedule);
  if (!heartbeat) {
    throw new HTTPException(404, { message: 'Heartbeat not found' });
  }
  return { schedule, heartbeat };
}

export const LIST_HEARTBEATS_ROUTE = createRoute({
  method: 'GET',
  path: '/heartbeats',
  responseType: 'json' as const,
  queryParamSchema: listHeartbeatsQuerySchema,
  responseSchema: listHeartbeatsResponseSchema,
  summary: 'List heartbeats across all agents',
  description:
    'Returns the configured heartbeats, optionally filtered by agentId. Hides the underlying schedule + workflow plumbing — each row is a flat Heartbeat view.',
  tags: ['Heartbeats'],
  requiresAuth: true,
  handler: async ({ mastra, agentId }) => {
    const schedulesStore = await mastra.getStorage()?.getStore('schedules');
    if (!schedulesStore) {
      return { heartbeats: [] };
    }
    const schedules = await schedulesStore.listSchedules({
      ownerType: 'agent',
      ...(agentId ? { ownerId: agentId } : {}),
    });
    const heartbeats = schedules.map(scheduleToHeartbeat).filter((h): h is NonNullable<typeof h> => h !== null);
    const hydrated = await Promise.all(heartbeats.map(h => hydrateHeartbeat(mastra, h)));
    return { heartbeats: hydrated };
  },
});

export const LIST_AGENT_HEARTBEATS_ROUTE = createRoute({
  method: 'GET',
  path: '/agents/:agentId/heartbeats',
  responseType: 'json' as const,
  pathParamSchema: heartbeatAgentPathParams,
  responseSchema: listHeartbeatsResponseSchema,
  summary: 'List heartbeats for an agent',
  description: 'Returns the heartbeats owned by the specified agent.',
  tags: ['Heartbeats'],
  requiresAuth: true,
  handler: async ({ mastra, agentId }) => {
    const schedulesStore = await mastra.getStorage()?.getStore('schedules');
    if (!schedulesStore) {
      return { heartbeats: [] };
    }
    const schedules = await schedulesStore.listSchedules({ ownerType: 'agent', ownerId: agentId });
    const heartbeats = schedules.map(scheduleToHeartbeat).filter((h): h is NonNullable<typeof h> => h !== null);
    const hydrated = await Promise.all(heartbeats.map(h => hydrateHeartbeat(mastra, h)));
    return { heartbeats: hydrated };
  },
});

export const GET_HEARTBEAT_ROUTE = createRoute({
  method: 'GET',
  path: '/agents/:agentId/heartbeats/:heartbeatId',
  responseType: 'json' as const,
  pathParamSchema: heartbeatPathParams,
  responseSchema: heartbeatSchema,
  summary: 'Get a heartbeat by ID',
  description: 'Returns a single heartbeat owned by the specified agent.',
  tags: ['Heartbeats'],
  requiresAuth: true,
  handler: async ({ mastra, agentId, heartbeatId }) => {
    const { heartbeat } = await loadOwnedHeartbeat(mastra, agentId, heartbeatId);
    return hydrateHeartbeat(mastra, heartbeat);
  },
});

export const CREATE_HEARTBEAT_ROUTE = createRoute({
  method: 'POST',
  path: '/agents/:agentId/heartbeats',
  responseType: 'json' as const,
  pathParamSchema: heartbeatAgentPathParams,
  bodySchema: createHeartbeatBodySchema,
  responseSchema: heartbeatSchema,
  summary: 'Create or upsert a heartbeat for an agent',
  description:
    'Creates a heartbeat owned by the agent. If `id` is supplied and a heartbeat with that id already exists for this agent, it is upserted (cron/prompt/payload rewritten). Goes through `agent.setHeartbeat()` so the implementation contract stays single-sourced.',
  tags: ['Heartbeats'],
  requiresAuth: true,
  handler: async ({ mastra, agentId, ...body }) => {
    const agent = mastra.getAgentById(agentId);
    if (!agent) {
      throw new HTTPException(404, { message: `Agent "${agentId}" not found` });
    }
    const schedule = await agent.setHeartbeat({
      cron: body.cron,
      prompt: body.prompt,
      ...(body.id ? { id: body.id } : {}),
      ...(body.timezone ? { timezone: body.timezone } : {}),
      ...(body.threadId ? { threadId: body.threadId } : {}),
      ...(body.resourceId ? { resourceId: body.resourceId } : {}),
      ...(body.signalType ? { signalType: body.signalType } : {}),
      ...(body.ifActive ? { ifActive: body.ifActive } : {}),
      ...(body.ifIdle ? { ifIdle: body.ifIdle } : {}),
      ...(body.activeHours ? { activeHours: body.activeHours } : {}),
      ...(body.idleThresholdMs !== undefined ? { idleThresholdMs: body.idleThresholdMs } : {}),
      ...(body.metadata ? { metadata: body.metadata } : {}),
    });
    const heartbeat = scheduleToHeartbeat(schedule);
    if (!heartbeat) {
      throw new HTTPException(500, { message: 'Failed to materialize heartbeat from schedule' });
    }
    return hydrateHeartbeat(mastra, heartbeat);
  },
});

export const UPDATE_HEARTBEAT_ROUTE = createRoute({
  method: 'PATCH',
  path: '/agents/:agentId/heartbeats/:heartbeatId',
  responseType: 'json' as const,
  pathParamSchema: heartbeatPathParams,
  bodySchema: updateHeartbeatBodySchema,
  responseSchema: heartbeatSchema,
  summary: 'Update a heartbeat',
  description:
    'Partial update of a heartbeat. `threadId` and `resourceId` are part of the heartbeat identity and cannot be changed — to re-target, delete and recreate. Editing `cron` (or `timezone`) recomputes `nextFireAt`.',
  tags: ['Heartbeats'],
  requiresAuth: true,
  handler: async ({ mastra, agentId, heartbeatId, ...body }) => {
    const { schedule } = await loadOwnedHeartbeat(mastra, agentId, heartbeatId);
    const schedulesStore = await mastra.getStorage()?.getStore('schedules');
    if (!schedulesStore) {
      throw new HTTPException(404, { message: 'Heartbeat not found' });
    }

    const nextCron = body.cron ?? schedule.cron;
    const nextTimezone = body.timezone !== undefined ? body.timezone : schedule.timezone;
    if (body.cron !== undefined || body.timezone !== undefined) {
      validateCron(nextCron, nextTimezone);
    }

    // Rebuild target.inputData by merging existing parsed input with the
    // patch. `agentId`, `scheduleId`, `threadId`, `resourceId` are identity
    // fields and are never editable.
    const existingInput = HeartbeatInputSchema.parse(schedule.target.inputData);
    const nextInput = {
      ...existingInput,
      ...(body.prompt !== undefined ? { prompt: body.prompt } : {}),
      ...(body.signalType !== undefined ? { signalType: body.signalType } : {}),
      ...(body.ifActive !== undefined ? { ifActive: body.ifActive } : {}),
      ...(body.ifIdle !== undefined ? { ifIdle: body.ifIdle } : {}),
      ...(body.activeHours !== undefined ? { activeHours: body.activeHours } : {}),
      ...(body.idleThresholdMs !== undefined ? { idleThresholdMs: body.idleThresholdMs } : {}),
    };

    const nextTarget: Schedule['target'] = {
      type: 'workflow',
      workflowId: HEARTBEAT_WORKFLOW_ID,
      inputData: nextInput,
    };

    const nextFireAt =
      body.cron !== undefined || body.timezone !== undefined
        ? computeNextFireAt(nextCron, { timezone: nextTimezone, after: Date.now() })
        : undefined;

    const updated = await schedulesStore.updateSchedule(heartbeatId, {
      ...(body.cron !== undefined ? { cron: body.cron } : {}),
      ...(body.timezone !== undefined ? { timezone: body.timezone } : {}),
      target: nextTarget,
      ...(nextFireAt !== undefined ? { nextFireAt } : {}),
      ...(body.metadata !== undefined ? { metadata: body.metadata } : {}),
    });
    const heartbeat = scheduleToHeartbeat(updated);
    if (!heartbeat) {
      throw new HTTPException(500, { message: 'Failed to materialize heartbeat from schedule' });
    }
    return hydrateHeartbeat(mastra, heartbeat);
  },
});

export const DELETE_HEARTBEAT_ROUTE = createRoute({
  method: 'DELETE',
  path: '/agents/:agentId/heartbeats/:heartbeatId',
  responseType: 'json' as const,
  pathParamSchema: heartbeatPathParams,
  responseSchema: deleteHeartbeatResponseSchema,
  summary: 'Delete a heartbeat',
  description:
    'Permanently deletes the heartbeat owned by the agent. No-op (still 200) when the heartbeat does not exist — caller has nothing to clean up.',
  tags: ['Heartbeats'],
  requiresAuth: true,
  handler: async ({ mastra, agentId, heartbeatId }) => {
    // Validate ownership before deleting (404 if missing/foreign).
    await loadOwnedHeartbeat(mastra, agentId, heartbeatId);
    const agent = mastra.getAgentById(agentId);
    if (!agent) {
      throw new HTTPException(404, { message: `Agent "${agentId}" not found` });
    }
    // `clearHeartbeat` accepts the full schedule id (starts with `hb_`).
    if (!heartbeatId.startsWith(HEARTBEAT_SCHEDULE_PREFIX)) {
      throw new HTTPException(404, { message: 'Heartbeat not found' });
    }
    await agent.clearHeartbeat(heartbeatId);
    return { message: 'Heartbeat deleted' };
  },
});

export const PAUSE_HEARTBEAT_ROUTE = createRoute({
  method: 'POST',
  path: '/agents/:agentId/heartbeats/:heartbeatId/pause',
  responseType: 'json' as const,
  pathParamSchema: heartbeatPathParams,
  responseSchema: heartbeatSchema,
  summary: 'Pause a heartbeat',
  description: 'Marks the heartbeat as paused. The scheduler tick loop will skip paused heartbeats. Idempotent.',
  tags: ['Heartbeats'],
  requiresAuth: true,
  handler: async ({ mastra, agentId, heartbeatId }) => {
    const { schedule } = await loadOwnedHeartbeat(mastra, agentId, heartbeatId);
    const schedulesStore = await mastra.getStorage()?.getStore('schedules');
    if (!schedulesStore) {
      throw new HTTPException(404, { message: 'Heartbeat not found' });
    }
    if (schedule.status === 'paused') {
      const view = scheduleToHeartbeat(schedule);
      if (!view) throw new HTTPException(500, { message: 'Failed to materialize heartbeat from schedule' });
      return hydrateHeartbeat(mastra, view);
    }
    const updated = await schedulesStore.updateSchedule(heartbeatId, { status: 'paused' });
    const view = scheduleToHeartbeat(updated);
    if (!view) throw new HTTPException(500, { message: 'Failed to materialize heartbeat from schedule' });
    return hydrateHeartbeat(mastra, view);
  },
});

export const RESUME_HEARTBEAT_ROUTE = createRoute({
  method: 'POST',
  path: '/agents/:agentId/heartbeats/:heartbeatId/resume',
  responseType: 'json' as const,
  pathParamSchema: heartbeatPathParams,
  responseSchema: heartbeatSchema,
  summary: 'Resume a paused heartbeat',
  description:
    'Marks the heartbeat as active and recomputes nextFireAt from "now" so a long-paused heartbeat does not fire a backlog. Idempotent.',
  tags: ['Heartbeats'],
  requiresAuth: true,
  handler: async ({ mastra, agentId, heartbeatId }) => {
    const { schedule } = await loadOwnedHeartbeat(mastra, agentId, heartbeatId);
    const schedulesStore = await mastra.getStorage()?.getStore('schedules');
    if (!schedulesStore) {
      throw new HTTPException(404, { message: 'Heartbeat not found' });
    }
    if (schedule.status === 'active') {
      const view = scheduleToHeartbeat(schedule);
      if (!view) throw new HTTPException(500, { message: 'Failed to materialize heartbeat from schedule' });
      return hydrateHeartbeat(mastra, view);
    }
    const nextFireAt = computeNextFireAt(schedule.cron, {
      timezone: schedule.timezone,
      after: Date.now(),
    });
    const updated = await schedulesStore.updateSchedule(heartbeatId, { status: 'active', nextFireAt });
    const view = scheduleToHeartbeat(updated);
    if (!view) throw new HTTPException(500, { message: 'Failed to materialize heartbeat from schedule' });
    return hydrateHeartbeat(mastra, view);
  },
});

export const LIST_HEARTBEAT_TRIGGERS_ROUTE = createRoute({
  method: 'GET',
  path: '/agents/:agentId/heartbeats/:heartbeatId/triggers',
  responseType: 'json' as const,
  pathParamSchema: heartbeatPathParams,
  queryParamSchema: listHeartbeatTriggersQuerySchema,
  responseSchema: listHeartbeatTriggersResponseSchema,
  summary: 'List trigger history for a heartbeat',
  description:
    'Returns the audit trail of fire attempts for a heartbeat, ordered by actualFireAt descending. Each trigger row is hydrated with the associated workflow run summary when available.',
  tags: ['Heartbeats'],
  requiresAuth: true,
  handler: async ({ mastra, agentId, heartbeatId, limit, fromActualFireAt, toActualFireAt }) => {
    await loadOwnedHeartbeat(mastra, agentId, heartbeatId);
    const schedulesStore = await mastra.getStorage()?.getStore('schedules');
    if (!schedulesStore) {
      return { triggers: [] };
    }
    const triggers = await schedulesStore.listTriggers(heartbeatId, { limit, fromActualFireAt, toActualFireAt });
    const hydrated = await Promise.all(
      triggers.map(async trigger => {
        if (trigger.outcome !== 'published' || !trigger.runId) return trigger;
        const run = await fetchRunSummary(mastra, HEARTBEAT_WORKFLOW_ID, trigger.runId);
        return run ? { ...trigger, run } : trigger;
      }),
    );
    return { triggers: hydrated };
  },
});
