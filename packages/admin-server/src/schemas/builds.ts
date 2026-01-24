import { z } from 'zod';
import { dateSchema, paginationQuerySchema } from './common';

/**
 * Build status enum.
 */
export const buildStatusSchema = z.enum([
  'queued',
  'building',
  'deploying',
  'succeeded',
  'failed',
  'cancelled',
]);

/**
 * Build trigger enum.
 */
export const buildTriggerSchema = z.enum([
  'manual',
  'webhook',
  'schedule',
  'rollback',
]);

/**
 * Build response schema.
 */
export const buildResponseSchema = z.object({
  id: z.string().uuid(),
  deploymentId: z.string().uuid(),
  trigger: buildTriggerSchema,
  triggeredBy: z.string(),
  commitSha: z.string(),
  commitMessage: z.string().nullable(),
  status: buildStatusSchema,
  queuedAt: dateSchema,
  startedAt: dateSchema.nullable(),
  completedAt: dateSchema.nullable(),
  errorMessage: z.string().nullable(),
});

export type BuildResponse = z.infer<typeof buildResponseSchema>;

/**
 * Build log line schema.
 */
export const buildLogLineSchema = z.object({
  timestamp: dateSchema,
  level: z.enum(['info', 'warn', 'error']),
  message: z.string(),
});

export type BuildLogLine = z.infer<typeof buildLogLineSchema>;

/**
 * Build logs response schema (for non-streaming).
 */
export const buildLogsResponseSchema = z.object({
  buildId: z.string().uuid(),
  logs: z.string(),
  complete: z.boolean(),
});

export type BuildLogsResponse = z.infer<typeof buildLogsResponseSchema>;

/**
 * List builds query params.
 */
export const listBuildsQuerySchema = paginationQuerySchema.extend({
  status: buildStatusSchema.optional(),
});

export type ListBuildsQuery = z.infer<typeof listBuildsQuerySchema>;

/**
 * Get build logs query params.
 */
export const getBuildLogsQuerySchema = z.object({
  stream: z.coerce.boolean().optional().default(false),
  since: z.coerce.number().int().nonnegative().optional(),
});

export type GetBuildLogsQuery = z.infer<typeof getBuildLogsQuerySchema>;
