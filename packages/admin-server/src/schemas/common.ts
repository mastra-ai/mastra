import { z } from 'zod';

/**
 * Pagination query parameters.
 */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  perPage: z.coerce.number().int().positive().max(100).optional().default(20),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

/**
 * Paginated response wrapper.
 */
export const paginatedResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    data: z.array(itemSchema),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    perPage: z.number().int().positive(),
    hasMore: z.boolean(),
  });

/**
 * UUID path parameter.
 */
export const uuidParamSchema = z.object({
  id: z.string().uuid(),
});

/**
 * Team ID path parameter.
 */
export const teamIdParamSchema = z.object({
  teamId: z.string().uuid(),
});

/**
 * Project ID path parameter.
 */
export const projectIdParamSchema = z.object({
  projectId: z.string().uuid(),
});

/**
 * Deployment ID path parameter.
 */
export const deploymentIdParamSchema = z.object({
  deploymentId: z.string().uuid(),
});

/**
 * Build ID path parameter.
 */
export const buildIdParamSchema = z.object({
  buildId: z.string().uuid(),
});

/**
 * Server ID path parameter.
 */
export const serverIdParamSchema = z.object({
  serverId: z.string().uuid(),
});

/**
 * Trace ID path parameter.
 */
export const traceIdParamSchema = z.object({
  traceId: z.string().uuid(),
});

/**
 * Source ID path parameter.
 */
export const sourceIdParamSchema = z.object({
  sourceId: z.string(),
});

/**
 * Invite ID path parameter.
 */
export const inviteIdParamSchema = z.object({
  inviteId: z.string().uuid(),
});

/**
 * User ID path parameter.
 */
export const userIdParamSchema = z.object({
  userId: z.string().uuid(),
});

/**
 * Token ID path parameter.
 */
export const tokenIdParamSchema = z.object({
  tokenId: z.string().uuid(),
});

/**
 * Environment variable key path parameter.
 */
export const envVarKeyParamSchema = z.object({
  key: z.string().min(1).max(256),
});

/**
 * Message response schema (for simple operations).
 */
export const messageResponseSchema = z.object({
  message: z.string(),
});

/**
 * Success response schema.
 */
export const successResponseSchema = z.object({
  success: z.boolean(),
});

/**
 * ID response schema (for create operations that return just an ID).
 */
export const idResponseSchema = z.object({
  id: z.string().uuid(),
});

/**
 * Time range query parameters for observability queries.
 */
export const timeRangeQuerySchema = z.object({
  startTime: z.coerce.date().optional(),
  endTime: z.coerce.date().optional(),
});

/**
 * Date schema that handles ISO string dates.
 */
export const dateSchema = z.coerce.date().transform(d => d.toISOString());
