import { z } from 'zod';

const monitorThresholdSchema = z.object({
  op: z.enum(['lt', 'lte', 'gt', 'gte']),
  value: z.number(),
});

const monitorChannelSchema = z.object({
  type: z.literal('webhook'),
  url: z.string().min(1),
  format: z.enum(['json', 'slack']).optional(),
});

const monitorScoreFilterSchema = z
  .object({
    scorerIds: z.array(z.string()).optional(),
    entityId: z.string().optional(),
    entityType: z.string().optional(),
    traceId: z.string().optional(),
    threadId: z.string().optional(),
    source: z.string().optional(),
    minScore: z.number().optional(),
    maxScore: z.number().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .optional();

export const createMonitorBodySchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  filter: monitorScoreFilterSchema,
  windowMinutes: z.number().positive(),
  aggregation: z.enum(['avg', 'p50', 'p95', 'count', 'passRate']),
  passThreshold: z.number().optional(),
  threshold: monitorThresholdSchema,
  cooldownMinutes: z.number().nonnegative().optional(),
  channels: z.array(monitorChannelSchema),
  noDataBehavior: z.enum(['skip', 'breach']).optional(),
  status: z.enum(['active', 'paused']).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const updateMonitorBodySchema = createMonitorBodySchema.omit({ id: true }).partial();

export const monitorSchema = createMonitorBodySchema.extend({
  id: z.string(),
  status: z.enum(['active', 'paused']),
  lastEvaluatedAt: z.number().optional(),
  lastBreachAt: z.number().optional(),
  breached: z.boolean().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const listMonitorsResponseSchema = z.object({
  monitors: z.array(monitorSchema),
});

export const monitorIdPathParams = z.object({
  monitorId: z.string(),
});

export const listMonitorEventsQuerySchema = z.object({
  limit: z.coerce.number().positive().optional(),
  type: z.enum(['breach', 'recovery', 'delivery_failure']).optional(),
});

export const monitorEventSchema = z.object({
  id: z.string().optional(),
  monitorId: z.string(),
  type: z.enum(['breach', 'recovery', 'delivery_failure']),
  value: z.number().nullable(),
  count: z.number(),
  threshold: monitorThresholdSchema,
  windowStart: z.number(),
  windowEnd: z.number(),
  error: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  createdAt: z.number(),
});

export const listMonitorEventsResponseSchema = z.object({
  events: z.array(monitorEventSchema),
});

export const evaluateMonitorsResponseSchema = z.object({
  results: z.array(
    z.object({
      monitorId: z.string(),
      value: z.number().nullable(),
      count: z.number(),
      breached: z.boolean(),
      notified: z.boolean(),
    }),
  ),
});
