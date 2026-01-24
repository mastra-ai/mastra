import { z } from 'zod';
import { dateSchema } from './common';

/**
 * Health status enum.
 */
export const healthStatusSchema = z.enum([
  'starting',
  'healthy',
  'unhealthy',
  'stopping',
]);

/**
 * Running server response schema.
 */
export const runningServerResponseSchema = z.object({
  id: z.string().uuid(),
  deploymentId: z.string().uuid(),
  buildId: z.string().uuid(),
  processId: z.number().int().nullable(),
  containerId: z.string().nullable(),
  host: z.string(),
  port: z.number().int(),
  healthStatus: healthStatusSchema,
  lastHealthCheck: dateSchema.nullable(),
  memoryUsageMb: z.number().nullable(),
  cpuPercent: z.number().nullable(),
  startedAt: dateSchema,
  stoppedAt: dateSchema.nullable(),
});

export type RunningServerResponse = z.infer<typeof runningServerResponseSchema>;

/**
 * Server health response schema.
 */
export const serverHealthResponseSchema = z.object({
  serverId: z.string().uuid(),
  status: healthStatusSchema,
  lastCheck: dateSchema,
  details: z.object({
    memoryUsageMb: z.number().nullable(),
    cpuPercent: z.number().nullable(),
    uptime: z.number().nullable(),
  }).optional(),
});

export type ServerHealthResponse = z.infer<typeof serverHealthResponseSchema>;

/**
 * Server metrics response schema.
 */
export const serverMetricsResponseSchema = z.object({
  serverId: z.string().uuid(),
  timestamp: dateSchema,
  memoryUsageMb: z.number().nullable(),
  cpuPercent: z.number().nullable(),
  requestCount: z.number().int().nonnegative().optional(),
  errorCount: z.number().int().nonnegative().optional(),
  avgResponseTimeMs: z.number().nonnegative().optional(),
});

export type ServerMetricsResponse = z.infer<typeof serverMetricsResponseSchema>;

/**
 * Server logs response schema (for non-streaming).
 */
export const serverLogsResponseSchema = z.object({
  serverId: z.string().uuid(),
  logs: z.string(),
  hasMore: z.boolean(),
});

export type ServerLogsResponse = z.infer<typeof serverLogsResponseSchema>;

/**
 * Get server logs query params.
 */
export const getServerLogsQuerySchema = z.object({
  stream: z.coerce.boolean().optional().default(false),
  tail: z.coerce.number().int().positive().optional().default(100),
  since: z.coerce.date().optional(),
});

export type GetServerLogsQuery = z.infer<typeof getServerLogsQuerySchema>;
