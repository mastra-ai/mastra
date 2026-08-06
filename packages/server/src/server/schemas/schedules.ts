import { z } from 'zod';

export const scheduleStatusSchema = z.enum(['active', 'paused']);

/** Mirrors the core `AgentSignalType` union. */
const signalTypeSchema = z.enum(['user', 'state', 'reactive', 'notification', 'user-message', 'system-reminder']);

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

export const workflowRunStatusSchema = z.enum([
  'running',
  'success',
  'failed',
  'tripwire',
  'suspended',
  'waiting',
  'pending',
  'canceled',
  'bailed',
  'paused',
  'skipped',
]);

export const scheduleRunSummarySchema = z.object({
  status: workflowRunStatusSchema,
  startedAt: z.number().optional(),
  completedAt: z.number().optional(),
  durationMs: z.number().optional(),
  error: z.string().optional(),
});

/**
 * Flat agent-schedule view. Persisted as a `Schedule` row with a
 * `target.type === 'agent'` variant; the HTTP surface flattens that
 * representation to the fields a user cares about (cron, prompt, threading,
 * status, lifecycle) without exposing the schedule plumbing. Discriminate
 * from workflow schedules by the presence of `agentId`.
 */
export const agentScheduleSchema = z.object({
  id: z.string(),
  agentId: z.string(),
  /** Mirror of the workflow-schedule discriminator — always absent on agent schedules. */
  workflowId: z.undefined().optional(),
  /** Workflow-run summary — never hydrated for agent schedules. */
  lastRun: z.undefined().optional(),
  name: z.string().optional(),
  threadId: z.string().optional(),
  resourceId: z.string().optional(),
  prompt: z.string(),
  cron: z.string(),
  timezone: z.string().optional(),
  status: scheduleStatusSchema,
  nextFireAt: z.number(),
  lastFireAt: z.number().optional(),
  lastRunId: z.string().optional(),
  signalType: signalTypeSchema.optional(),
  tagName: z.string().optional(),
  attributes: signalAttributesSchema.optional(),
  ifActive: ifActiveSchema.optional(),
  ifIdle: ifIdleSchema.optional(),
  providerOptions: z.record(z.string(), z.unknown()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

/**
 * Flat workflow-schedule view. Discriminate from agent schedules by the
 * presence of `workflowId`.
 */
export const workflowScheduleSchema = z.object({
  id: z.string(),
  workflowId: z.string(),
  /** Mirror of the agent-schedule discriminator — always absent on workflow schedules. */
  agentId: z.undefined().optional(),
  cron: z.string(),
  timezone: z.string().optional(),
  status: scheduleStatusSchema,
  nextFireAt: z.number(),
  lastFireAt: z.number().optional(),
  lastRunId: z.string().optional(),
  lastRun: scheduleRunSummarySchema.optional(),
  inputData: z.unknown().optional(),
  initialState: z.unknown().optional(),
  requestContext: z.record(z.string(), z.unknown()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

/** Union of the flat views returned by the unified `/schedules` surface. */
export const scheduleSchema = z.union([agentScheduleSchema, workflowScheduleSchema]);

export const scheduleTriggerOutcomeSchema = z.enum([
  'published',
  'succeeded',
  'delivered',
  'persisted',
  'discarded',
  'skipped',
  'aborted',
  'failed',
  // Legacy queue/notification outcomes — no longer written, but trigger rows
  // persisted by older builds may still carry them. Kept readable so the
  // response validator does not reject historical rows. Mirrors the core
  // ScheduleTriggerOutcome union.
  'acked',
  'alerted',
  'deferred',
  'appended-from-queue',
  'dropped-stale',
  'dropped-superseded',
  'dropped-busy',
]);

export const scheduleTriggerKindSchema = z.enum(['schedule-fire', 'queue-drain', 'manual']);

export const scheduleTriggerResponseSchema = z.object({
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

export const listSchedulesQuerySchema = z.object({
  agentId: z.string().optional(),
  workflowId: z.string().optional(),
  status: scheduleStatusSchema.optional(),
  /** Agent-schedule only: match the target threadId. */
  threadId: z.string().optional(),
  /** Agent-schedule only: match the target resourceId. */
  resourceId: z.string().optional(),
  /** Agent-schedule only: match the free-form target name. */
  name: z.string().optional(),
});

export const listSchedulesResponseSchema = z.object({
  schedules: z.array(scheduleSchema),
});

export const scheduleIdPathParams = z.object({
  scheduleId: z.string(),
});

/**
 * Agent variant of the create body — targets an agent by `agentId`. Strict so
 * a body carrying both `agentId` and `workflowId` is rejected as ambiguous
 * instead of silently matching the agent branch of the union.
 */
const createAgentScheduleBodySchema = z.strictObject({
  /** Optional stable id; normalized to `agent_<slug>`. A random id is generated when omitted. */
  id: z.string().optional(),
  agentId: z.string().min(1),
  cron: z.string(),
  timezone: z.string().optional(),
  prompt: z.string(),
  name: z.string().optional(),
  threadId: z.string().optional(),
  resourceId: z.string().optional(),
  signalType: signalTypeSchema.optional(),
  tagName: z.string().optional(),
  attributes: signalAttributesSchema.optional(),
  ifActive: ifActiveSchema.optional(),
  ifIdle: ifIdleSchema.optional(),
  providerOptions: z.record(z.string(), z.unknown()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Workflow variant of the create body — targets a workflow by `workflowId`.
 * Strict so ambiguous bodies (both ids) are rejected by the union.
 */
const createWorkflowScheduleBodySchema = z.strictObject({
  /** Optional stable id; normalized to `schedule_<slug>`. A random id is generated when omitted. */
  id: z.string().optional(),
  workflowId: z.string().min(1),
  cron: z.string(),
  timezone: z.string().optional(),
  inputData: z.unknown().optional(),
  initialState: z.unknown().optional(),
  requestContext: z.record(z.string(), z.unknown()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Body for POST /schedules. Discriminated by which target id is present:
 * `agentId` creates an agent schedule, `workflowId` a workflow schedule.
 * Both variants are strict, so a body carrying both ids (or unknown keys)
 * fails validation instead of silently dropping fields.
 */
export const createScheduleBodySchema = z.union([createAgentScheduleBodySchema, createWorkflowScheduleBodySchema]);

/**
 * Body for PATCH /schedules/:scheduleId — partial update. Fields apply to
 * the matching target type; agent-only fields on a workflow schedule are
 * rejected by the service. `threadId` / `resourceId` are intentionally not
 * editable; they are part of an agent schedule's identity. To re-target,
 * delete and recreate.
 */
export const updateScheduleBodySchema = z.object({
  cron: z.string().optional(),
  timezone: z.string().optional(),
  status: scheduleStatusSchema.optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  // Agent-schedule fields
  prompt: z.string().optional(),
  name: z.string().optional(),
  signalType: signalTypeSchema.optional(),
  tagName: z.string().optional(),
  attributes: signalAttributesSchema.optional(),
  ifActive: ifActiveSchema.optional(),
  ifIdle: ifIdleSchema.optional(),
  providerOptions: z.record(z.string(), z.unknown()).optional(),
  // Workflow-schedule fields
  inputData: z.unknown().optional(),
  initialState: z.unknown().optional(),
  requestContext: z.record(z.string(), z.unknown()).optional(),
});

export const deleteScheduleResponseSchema = z.object({
  message: z.string(),
});

/** Response for POST /schedules/:scheduleId/run. */
export const runScheduleResponseSchema = z.object({
  scheduleId: z.string(),
  claimId: z.string(),
  scheduledFireAt: z.number(),
});

export const listScheduleTriggersQuerySchema = z.object({
  limit: z.coerce.number().int().positive().optional(),
  fromActualFireAt: z.coerce.number().int().nonnegative().optional(),
  toActualFireAt: z.coerce.number().int().nonnegative().optional(),
});

export const listScheduleTriggersResponseSchema = z.object({
  triggers: z.array(scheduleTriggerResponseSchema),
});

export type AgentScheduleResponse = z.infer<typeof agentScheduleSchema>;
export type WorkflowScheduleResponse = z.infer<typeof workflowScheduleSchema>;
export type ScheduleResponse = z.infer<typeof scheduleSchema>;
