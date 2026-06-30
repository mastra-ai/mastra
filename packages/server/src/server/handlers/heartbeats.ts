import type { Mastra } from '@mastra/core';
import { HTTPException } from '../http-exception';
import {
  createHeartbeatBodySchema,
  deleteHeartbeatResponseSchema,
  heartbeatPathParams,
  heartbeatSchema,
  listHeartbeatsQuerySchema,
  listHeartbeatsResponseSchema,
  runHeartbeatResponseSchema,
  updateHeartbeatBodySchema,
} from '../schemas/heartbeats';
import { createRoute } from '../server-adapter/routes/route-builder';

/**
 * Lazily access `mastra.heartbeats`. The Heartbeats service may not exist on
 * older `@mastra/core` versions; in that case the handler returns 404 so
 * older cores degrade gracefully when paired with this `@mastra/server`.
 */
function getHeartbeats(mastra: Mastra): any {
  const svc = (mastra as unknown as { heartbeats?: unknown }).heartbeats;
  if (!svc) {
    throw new HTTPException(404, { message: 'Heartbeats not supported by this server' });
  }
  return svc;
}

/**
 * Resolve a heartbeat by its globally-unique `hb_<uuid>` id. Returns 404 for
 * missing rows. Heartbeats are addressed by id (consistent with
 * `/schedules/:scheduleId`); the owning `agentId` is a property, not a key.
 */
async function loadHeartbeat(mastra: Mastra, heartbeatId: string) {
  const heartbeats = getHeartbeats(mastra);
  const heartbeat = await heartbeats.get(heartbeatId);
  if (!heartbeat) {
    throw new HTTPException(404, { message: 'Heartbeat not found' });
  }
  return heartbeat;
}

export const LIST_HEARTBEATS_ROUTE = createRoute({
  method: 'GET',
  path: '/heartbeats',
  responseType: 'json' as const,
  queryParamSchema: listHeartbeatsQuerySchema,
  responseSchema: listHeartbeatsResponseSchema,
  summary: 'List heartbeats across all agents',
  description: 'Returns the configured heartbeats, optionally filtered by agentId/threadId/resourceId/name.',
  tags: ['Heartbeats'],
  requiresAuth: true,
  handler: async ({ mastra, agentId, threadId, resourceId, name }) => {
    const heartbeats = getHeartbeats(mastra);
    const filter: Record<string, string> = {};
    if (agentId) filter.agentId = agentId;
    if (threadId) filter.threadId = threadId;
    if (resourceId) filter.resourceId = resourceId;
    if (name) filter.name = name;
    const rows = await heartbeats.list(filter);
    return { heartbeats: rows };
  },
});

export const GET_HEARTBEAT_ROUTE = createRoute({
  method: 'GET',
  path: '/heartbeats/:heartbeatId',
  responseType: 'json' as const,
  pathParamSchema: heartbeatPathParams,
  responseSchema: heartbeatSchema,
  summary: 'Get a heartbeat by ID',
  description: 'Returns a single heartbeat by its id.',
  tags: ['Heartbeats'],
  requiresAuth: true,
  handler: async ({ mastra, heartbeatId }) => {
    return await loadHeartbeat(mastra, heartbeatId);
  },
});

export const CREATE_HEARTBEAT_ROUTE = createRoute({
  method: 'POST',
  path: '/heartbeats',
  responseType: 'json' as const,
  bodySchema: createHeartbeatBodySchema,
  responseSchema: heartbeatSchema,
  summary: 'Create a heartbeat',
  description:
    'Creates a new heartbeat owned by the agent named in `agentId`. Multiple heartbeats per agent/thread are supported; each gets a random `hb_<uuid>` id. Use `name` to label distinct heartbeats on the same agent/thread.',
  tags: ['Heartbeats'],
  requiresAuth: true,
  handler: async ({ mastra, agentId, ...body }) => {
    // getAgentById throws a MastraError (status 404) when the agent is unknown;
    // translate that into a clean HTTP 404 instead of letting it surface as 500.
    try {
      mastra.getAgentById(agentId);
    } catch {
      throw new HTTPException(404, { message: `Agent "${agentId}" not found` });
    }
    const heartbeats = getHeartbeats(mastra);
    return await heartbeats.create({
      agentId,
      cron: body.cron,
      prompt: body.prompt,
      ...(body.id ? { id: body.id } : {}),
      ...(body.name ? { name: body.name } : {}),
      ...(body.timezone ? { timezone: body.timezone } : {}),
      ...(body.threadId ? { threadId: body.threadId } : {}),
      ...(body.resourceId ? { resourceId: body.resourceId } : {}),
      ...(body.signalType ? { signalType: body.signalType } : {}),
      ...(body.tagName ? { tagName: body.tagName } : {}),
      ...(body.attributes ? { attributes: body.attributes } : {}),
      ...(body.ifActive ? { ifActive: body.ifActive } : {}),
      ...(body.ifIdle ? { ifIdle: body.ifIdle } : {}),
      ...(body.providerOptions ? { providerOptions: body.providerOptions } : {}),
      ...(body.metadata ? { metadata: body.metadata } : {}),
    });
  },
});

export const UPDATE_HEARTBEAT_ROUTE = createRoute({
  method: 'PATCH',
  path: '/heartbeats/:heartbeatId',
  responseType: 'json' as const,
  pathParamSchema: heartbeatPathParams,
  bodySchema: updateHeartbeatBodySchema,
  responseSchema: heartbeatSchema,
  summary: 'Update a heartbeat',
  description:
    'Partial update of a heartbeat. `threadId` and `resourceId` are part of the heartbeat identity and cannot be changed — to re-target, delete and recreate. Editing `cron` (or `timezone`) recomputes `nextFireAt`.',
  tags: ['Heartbeats'],
  requiresAuth: true,
  handler: async ({ mastra, heartbeatId, ...body }) => {
    await loadHeartbeat(mastra, heartbeatId);
    const heartbeats = getHeartbeats(mastra);
    return await heartbeats.update(heartbeatId, {
      ...(body.cron !== undefined ? { cron: body.cron } : {}),
      ...(body.timezone !== undefined ? { timezone: body.timezone } : {}),
      ...(body.prompt !== undefined ? { prompt: body.prompt } : {}),
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.signalType !== undefined ? { signalType: body.signalType } : {}),
      ...(body.tagName !== undefined ? { tagName: body.tagName } : {}),
      ...(body.attributes !== undefined ? { attributes: body.attributes } : {}),
      ...(body.ifActive !== undefined ? { ifActive: body.ifActive } : {}),
      ...(body.ifIdle !== undefined ? { ifIdle: body.ifIdle } : {}),
      ...(body.providerOptions !== undefined ? { providerOptions: body.providerOptions } : {}),
      ...(body.metadata !== undefined ? { metadata: body.metadata } : {}),
    });
  },
});

export const DELETE_HEARTBEAT_ROUTE = createRoute({
  method: 'DELETE',
  path: '/heartbeats/:heartbeatId',
  responseType: 'json' as const,
  pathParamSchema: heartbeatPathParams,
  responseSchema: deleteHeartbeatResponseSchema,
  summary: 'Delete a heartbeat',
  description: 'Permanently deletes the heartbeat. 404 when the heartbeat does not exist.',
  tags: ['Heartbeats'],
  requiresAuth: true,
  handler: async ({ mastra, heartbeatId }) => {
    await loadHeartbeat(mastra, heartbeatId);
    const heartbeats = getHeartbeats(mastra);
    await heartbeats.delete(heartbeatId);
    return { message: 'Heartbeat deleted' };
  },
});

export const PAUSE_HEARTBEAT_ROUTE = createRoute({
  method: 'POST',
  path: '/heartbeats/:heartbeatId/pause',
  responseType: 'json' as const,
  pathParamSchema: heartbeatPathParams,
  responseSchema: heartbeatSchema,
  summary: 'Pause a heartbeat',
  description: 'Marks the heartbeat as paused. The scheduler tick loop will skip paused heartbeats. Idempotent.',
  tags: ['Heartbeats'],
  requiresAuth: true,
  handler: async ({ mastra, heartbeatId }) => {
    await loadHeartbeat(mastra, heartbeatId);
    const heartbeats = getHeartbeats(mastra);
    return await heartbeats.pause(heartbeatId);
  },
});

export const RESUME_HEARTBEAT_ROUTE = createRoute({
  method: 'POST',
  path: '/heartbeats/:heartbeatId/resume',
  responseType: 'json' as const,
  pathParamSchema: heartbeatPathParams,
  responseSchema: heartbeatSchema,
  summary: 'Resume a paused heartbeat',
  description:
    'Marks the heartbeat as active and recomputes nextFireAt from "now" so a long-paused heartbeat does not fire a backlog. Idempotent.',
  tags: ['Heartbeats'],
  requiresAuth: true,
  handler: async ({ mastra, heartbeatId }) => {
    await loadHeartbeat(mastra, heartbeatId);
    const heartbeats = getHeartbeats(mastra);
    return await heartbeats.resume(heartbeatId);
  },
});

export const RUN_HEARTBEAT_ROUTE = createRoute({
  method: 'POST',
  path: '/heartbeats/:heartbeatId/run',
  responseType: 'json' as const,
  pathParamSchema: heartbeatPathParams,
  responseSchema: runHeartbeatResponseSchema,
  summary: 'Fire a heartbeat now',
  description:
    'Manually triggers a single heartbeat run out-of-band from the cron schedule. Records a trigger row with `triggerKind: "manual"`. Does not advance `nextFireAt`.',
  tags: ['Heartbeats'],
  requiresAuth: true,
  handler: async ({ mastra, heartbeatId }) => {
    await loadHeartbeat(mastra, heartbeatId);
    const heartbeats = getHeartbeats(mastra);
    return await heartbeats.run(heartbeatId);
  },
});
