import { z } from 'zod';

export const scheduleStatusSchema = z.enum(['active', 'paused']);

const workflowScheduleTargetSchema = z.object({
  type: z.literal('workflow'),
  workflowId: z.string(),
  inputData: z.unknown().optional(),
  initialState: z.unknown().optional(),
  requestContext: z.record(z.string(), z.unknown()).optional(),
});

const signalAttributesSchema = z.record(
  z.string(),
  z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
);

const ifActiveSchema = z.object({
  behavior: z.enum(['deliver', 'persist', 'discard']).optional(),
  attributes: signalAttributesSchema.optional(),
});

const ifIdleSchema = z.object({
  behavior: z.enum(['wake', 'persist', 'discard']).optional(),
  attributes: signalAttributesSchema.optional(),
  streamOptions: z
    .object({
      requestContext: z.record(z.string(), z.unknown()).optional(),
    })
    .optional(),
});

const heartbeatScheduleTargetSchema = z.object({
  type: z.literal('heartbeat'),
  agentId: z.string(),
  prompt: z.string(),
  threadId: z.string().optional(),
  resourceId: z.string().optional(),
  signalType: z.string().optional(),
  tagName: z.string().optional(),
  attributes: signalAttributesSchema.optional(),
  ifActive: ifActiveSchema.optional(),
  ifIdle: ifIdleSchema.optional(),
  providerOptions: z.record(z.string(), z.unknown()).optional(),
  requestContext: z.record(z.string(), z.unknown()).optional(),
});

export const scheduleTargetSchema = z.discriminatedUnion('type', [
  workflowScheduleTargetSchema,
  heartbeatScheduleTargetSchema,
]);

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

export const scheduleResponseSchema = z.object({
  id: z.string(),
  target: scheduleTargetSchema,
  cron: z.string(),
  timezone: z.string().optional(),
  status: scheduleStatusSchema,
  nextFireAt: z.number(),
  lastFireAt: z.number().optional(),
  lastRunId: z.string().optional(),
  lastRun: scheduleRunSummarySchema.optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  ownerType: z.string().optional(),
  ownerId: z.string().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

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

export const listSchedulesQuerySchema = z
  .object({
    workflowId: z.string().optional(),
    status: scheduleStatusSchema.optional(),
    ownerType: z.string().optional(),
    ownerId: z.string().optional(),
  })
  .refine(data => data.ownerId === undefined || data.ownerType !== undefined, {
    message: 'ownerId can only be used together with ownerType',
    path: ['ownerId'],
  });

export const listSchedulesResponseSchema = z.object({
  schedules: z.array(scheduleResponseSchema),
});

export const scheduleIdPathParams = z.object({
  scheduleId: z.string(),
});

export const listScheduleTriggersQuerySchema = z.object({
  limit: z.coerce.number().int().positive().optional(),
  fromActualFireAt: z.coerce.number().int().nonnegative().optional(),
  toActualFireAt: z.coerce.number().int().nonnegative().optional(),
});

export const listScheduleTriggersResponseSchema = z.object({
  triggers: z.array(scheduleTriggerResponseSchema),
});
