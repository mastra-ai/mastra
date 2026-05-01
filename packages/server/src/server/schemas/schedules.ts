import { z } from 'zod';

export const scheduleStatusSchema = z.enum(['active', 'paused']);

export const scheduleTargetSchema = z.object({
  type: z.literal('workflow'),
  workflowId: z.string(),
  inputData: z.unknown().optional(),
  initialState: z.unknown().optional(),
  requestContext: z.record(z.string(), z.unknown()).optional(),
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
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const scheduleTriggerStatusSchema = z.enum(['published', 'failed']);

export const scheduleTriggerResponseSchema = z.object({
  scheduleId: z.string(),
  runId: z.string(),
  scheduledFireAt: z.number(),
  actualFireAt: z.number(),
  status: scheduleTriggerStatusSchema,
  error: z.string().optional(),
  run: scheduleRunSummarySchema.optional(),
});

export const listSchedulesQuerySchema = z.object({
  workflowId: z.string().optional(),
  status: scheduleStatusSchema.optional(),
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
