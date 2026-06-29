import { z } from 'zod';
import { scheduleRunSummarySchema } from './schedules';

/** Attributes rendered onto the signal's XML tag. */
const signalAttributesSchema = z.record(
  z.string(),
  z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
);

/** Behavior + attributes applied when the thread is already streaming. */
const ifActiveSchema = z.object({
  behavior: z.enum(['deliver', 'persist', 'discard']).optional(),
  attributes: signalAttributesSchema.optional(),
});

/**
 * Behavior + attributes applied when the thread is idle, plus a serializable
 * subset of stream options forwarded to the woken run.
 */
const ifIdleSchema = z.object({
  behavior: z.enum(['wake', 'persist', 'discard']).optional(),
  attributes: signalAttributesSchema.optional(),
  streamOptions: z
    .object({
      requestContext: z.record(z.string(), z.unknown()).optional(),
    })
    .optional(),
});

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
  tagName: z.string().optional(),
  attributes: signalAttributesSchema.optional(),
  ifActive: ifActiveSchema.optional(),
  ifIdle: ifIdleSchema.optional(),
  providerOptions: z.record(z.string(), z.unknown()).optional(),
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

export const heartbeatPathParams = z.object({
  heartbeatId: z.string(),
});

/** Body for POST /heartbeats — creates a heartbeat. */
export const createHeartbeatBodySchema = z.object({
  /** Optional stable id; normalized to `hb_<slug>`. A random id is generated when omitted. */
  id: z.string().optional(),
  agentId: z.string(),
  cron: z.string(),
  timezone: z.string().optional(),
  prompt: z.string(),
  name: z.string().optional(),
  threadId: z.string().optional(),
  resourceId: z.string().optional(),
  signalType: z.string().optional(),
  tagName: z.string().optional(),
  attributes: signalAttributesSchema.optional(),
  ifActive: ifActiveSchema.optional(),
  ifIdle: ifIdleSchema.optional(),
  providerOptions: z.record(z.string(), z.unknown()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Body for PATCH /heartbeats/:heartbeatId — partial update.
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
  tagName: z.string().optional(),
  attributes: signalAttributesSchema.optional(),
  ifActive: ifActiveSchema.optional(),
  ifIdle: ifIdleSchema.optional(),
  providerOptions: z.record(z.string(), z.unknown()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const deleteHeartbeatResponseSchema = z.object({
  message: z.string(),
});

/** Response for POST /heartbeats/:heartbeatId/run. */
export const runHeartbeatResponseSchema = z.object({
  scheduleId: z.string(),
  claimId: z.string(),
  scheduledFireAt: z.number(),
});

export type HeartbeatResponse = z.infer<typeof heartbeatSchema>;
