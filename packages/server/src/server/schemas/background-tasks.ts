import { z } from 'zod';

export const backgroundTaskStatusSchema = z.enum([
  'pending',
  'running',
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

export const backgroundTaskDateColumnSchema = z.enum(['createdAt', 'startedAt', 'completedAt']);

export const listBackgroundTasksQuerySchema = z.object({
  agentId: z.string().optional(),
  status: backgroundTaskStatusSchema.optional(),
  runId: z.string().optional(),
  threadId: z.string().optional(),
  resourceId: z.string().optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
  dateFilterBy: backgroundTaskDateColumnSchema.optional(),
  orderBy: backgroundTaskDateColumnSchema.optional(),
  orderDirection: z.enum(['asc', 'desc']).optional(),
  page: z.coerce.number().optional(),
  perPage: z.coerce.number().optional(),
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
});

export const listBackgroundTaskResponseSchema = z.object({
  tasks: z.array(backgroundTaskResponseSchema),
  total: z.number(),
});

export const backgroundTaskStreamResponseSchema = z.any();
