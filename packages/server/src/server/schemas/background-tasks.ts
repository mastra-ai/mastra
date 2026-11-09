import { z } from 'zod';
import { paginationNumber } from './common';

export const backgroundTaskStatusSchema = z.enum([
  'pending',
  'running',
  'suspended',
  'completed',
  'failed',
  'cancelled',
  'timed_out',
]);

export const backgroundTaskStreamQuerySchema = z.object({
  agentId: z.string().optional(),
  runId: z.string().optional(),
  threadId: z.string().optional(),
  resourceId: z.string().optional(),
  taskId: z.string().optional(),
});

export const backgroundTaskDateColumnSchema = z.enum(['createdAt', 'startedAt', 'suspendedAt', 'completedAt']);

export const listBackgroundTasksQuerySchema = z.object({
  agentId: z.string().optional(),
  status: backgroundTaskStatusSchema.optional(),
  runId: z.string().optional(),
  threadId: z.string().optional(),
  resourceId: z.string().optional(),
  toolName: z.string().optional(),
  toolCallId: z.string().optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
  dateFilterBy: backgroundTaskDateColumnSchema.optional(),
  orderBy: backgroundTaskDateColumnSchema.optional(),
  orderDirection: z.enum(['asc', 'desc']).optional(),
  page: paginationNumber().optional(),
  perPage: paginationNumber().optional(),
});

export const backgroundTaskIdPathParams = z.object({
  backgroundTaskId: z.string(),
});

export const backgroundTaskResponseSchema = z.object({
  id: z.string(),
  status: backgroundTaskStatusSchema,
  toolName: z.string(),
  toolCallId: z.string(),
  args: z.record(z.string(), z.unknown()),
  agentId: z.string(),
  threadId: z.string().optional(),
  resourceId: z.string().optional(),
  runId: z.string(),
  result: z.unknown().optional(),
  error: z.object({ message: z.string(), stack: z.string().optional() }).optional(),
  createdAt: z.date(),
  startedAt: z.date().optional(),
  completedAt: z.date().optional(),
  retryCount: z.number(),
  maxRetries: z.number(),
  timeoutMs: z.number(),
  suspendPayload: z.unknown().optional(),
  suspendedAt: z.date().optional(),
});

export const resumeBackgroundTaskBodySchema = z
  .object({
    // A background tool treats a missing `resumeData` as a fresh run, so an
    // answer must carry one (any value, `null` included).
    resumeData: z.unknown(),
    // The `suspendedAt` of the suspension being answered (ISO string or epoch
    // milliseconds, as read from the task). A task that has since resumed or
    // suspended again is rejected with 409 instead of receiving a stale answer.
    suspendedAt: z.union([z.string().datetime({ offset: true }), z.number().int().nonnegative()]).optional(),
  })
  // `z.unknown()` alone lets a missing key through on Zod 3 and Zod 4 before 4.4.
  .refine(body => body.resumeData !== undefined, { message: 'resumeData is required', path: ['resumeData'] });

export const listBackgroundTaskResponseSchema = z.object({
  tasks: z.array(backgroundTaskResponseSchema),
  total: z.number(),
});

export const backgroundTaskStreamResponseSchema = z.unknown();
