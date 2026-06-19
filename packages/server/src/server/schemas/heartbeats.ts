import { z } from 'zod';
import { scheduleRunSummarySchema, scheduleTriggerKindSchema, scheduleTriggerOutcomeSchema } from './schedules';

/**
 * Broadcast policy for the chunks produced by a heartbeat-driven run.
 *
 * - `live` (default) — pass every chunk through to subscribers
 * - `on-complete` — drop intermediate chunks; replay full text on finish
 * - `never` — drop every chunk (the run still happens server-side)
 */
export const heartbeatBroadcastModeSchema = z.enum(['live', 'on-complete', 'never']);

/**
 * Public Heartbeat view model.
 *
 * Heartbeats are persisted as `Schedule` rows with a dedicated
 * `target.type === 'heartbeat'` variant. The HTTP surface flattens that
 * representation to the fields a user cares about (cron, prompt, threading,
 * status, lifecycle) without exposing the schedule plumbing or internal
 * identifier prefix.
 */
export const heartbeatSchema = z.object({
  id: z.string(),
  agentId: z.string(),
  name: z.string().optional(),
  threadId: z.string().optional(),
  resourceId: z.string().optional(),
  prompt: z.string(),
  cron: z.string(),
  timezone: z.string().optional(),
  status: z.enum(['active', 'paused']),
  nextFireAt: z.number(),
  lastFireAt: z.number().optional(),
  lastRunId: z.string().optional(),
  lastRun: scheduleRunSummarySchema.optional(),
  signalType: z.string().optional(),
  ifActive: z.enum(['deliver', 'persist', 'discard']).optional(),
  ifIdle: z.enum(['wake', 'persist', 'discard']).optional(),
  activeHours: z
    .object({
      start: z.string(),
      end: z.string(),
      timezone: z.string().optional(),
    })
    .optional(),
  idleThresholdMs: z.number().int().positive().optional(),
  broadcast: heartbeatBroadcastModeSchema.optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const listHeartbeatsResponseSchema = z.object({
  heartbeats: z.array(heartbeatSchema),
});

export const listHeartbeatsQuerySchema = z.object({
  agentId: z.string().optional(),
  threadId: z.string().optional(),
  resourceId: z.string().optional(),
  name: z.string().optional(),
});

export const heartbeatAgentPathParams = z.object({
  agentId: z.string(),
});

export const heartbeatPathParams = heartbeatAgentPathParams.extend({
  heartbeatId: z.string(),
});

const activeHoursBodySchema = z.object({
  start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'expected HH:mm'),
  end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'expected HH:mm'),
  timezone: z.string().optional(),
});

/** Body for POST /agents/:agentId/heartbeats — creates a heartbeat. */
export const createHeartbeatBodySchema = z.object({
  cron: z.string(),
  timezone: z.string().optional(),
  prompt: z.string(),
  name: z.string().optional(),
  threadId: z.string().optional(),
  resourceId: z.string().optional(),
  signalType: z.string().optional(),
  ifActive: z.enum(['deliver', 'persist', 'discard']).optional(),
  ifIdle: z.enum(['wake', 'persist', 'discard']).optional(),
  activeHours: activeHoursBodySchema.optional(),
  idleThresholdMs: z.number().int().positive().optional(),
  broadcast: heartbeatBroadcastModeSchema.optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Body for PATCH /agents/:agentId/heartbeats/:heartbeatId — partial update.
 *
 * `threadId` / `resourceId` are intentionally not editable; they are part of
 * the heartbeat's identity. To re-target, delete and recreate.
 */
export const updateHeartbeatBodySchema = z.object({
  cron: z.string().optional(),
  timezone: z.string().optional(),
  prompt: z.string().optional(),
  name: z.string().optional(),
  signalType: z.string().optional(),
  ifActive: z.enum(['deliver', 'persist', 'discard']).optional(),
  ifIdle: z.enum(['wake', 'persist', 'discard']).optional(),
  activeHours: activeHoursBodySchema.optional(),
  idleThresholdMs: z.number().int().positive().optional(),
  broadcast: heartbeatBroadcastModeSchema.optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const heartbeatTriggerSchema = z.object({
  id: z.string().optional(),
  scheduleId: z.string(),
  runId: z.string().nullable(),
  scheduledFireAt: z.number(),
  actualFireAt: z.number(),
  outcome: scheduleTriggerOutcomeSchema,
  error: z.string().optional(),
  triggerKind: scheduleTriggerKindSchema.optional(),
  parentTriggerId: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  run: scheduleRunSummarySchema.optional(),
});

export const listHeartbeatTriggersResponseSchema = z.object({
  triggers: z.array(heartbeatTriggerSchema),
});

export const listHeartbeatTriggersQuerySchema = z.object({
  limit: z.coerce.number().int().positive().optional(),
  fromActualFireAt: z.coerce.number().int().nonnegative().optional(),
  toActualFireAt: z.coerce.number().int().nonnegative().optional(),
});

export const deleteHeartbeatResponseSchema = z.object({
  message: z.string(),
});

/** Response for POST /agents/:agentId/heartbeats/:heartbeatId/run. */
export const runHeartbeatResponseSchema = z.object({
  scheduleId: z.string(),
  claimId: z.string(),
  scheduledFireAt: z.number(),
});

export type HeartbeatResponse = z.infer<typeof heartbeatSchema>;
