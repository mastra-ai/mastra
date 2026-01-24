import { z } from 'zod';
import { dateSchema, paginationQuerySchema, timeRangeQuerySchema } from './common';

/**
 * Span event schema.
 */
export const spanEventSchema = z.object({
  name: z.string(),
  timestamp: dateSchema,
  attributes: z.record(z.unknown()).optional(),
});

/**
 * Span schema.
 */
export const spanSchema = z.object({
  spanId: z.string(),
  traceId: z.string(),
  parentSpanId: z.string().nullable(),
  name: z.string(),
  kind: z.string().optional(),
  startTime: dateSchema,
  endTime: dateSchema.nullable(),
  durationMs: z.number().nullable(),
  status: z.enum(['ok', 'error', 'unset']).optional(),
  attributes: z.record(z.unknown()).optional(),
  events: z.array(spanEventSchema).optional(),
});

export type SpanResponse = z.infer<typeof spanSchema>;

/**
 * Trace response schema.
 */
export const traceResponseSchema = z.object({
  traceId: z.string(),
  projectId: z.string().uuid(),
  name: z.string(),
  startTime: dateSchema,
  endTime: dateSchema.nullable(),
  durationMs: z.number().nullable(),
  status: z.enum(['ok', 'error', 'unset']).optional(),
  spanCount: z.number().int().nonnegative(),
  attributes: z.record(z.unknown()).optional(),
});

export type TraceResponse = z.infer<typeof traceResponseSchema>;

/**
 * Trace with spans response schema.
 */
export const traceWithSpansResponseSchema = traceResponseSchema.extend({
  spans: z.array(spanSchema),
});

export type TraceWithSpansResponse = z.infer<typeof traceWithSpansResponseSchema>;

/**
 * Log entry response schema.
 */
export const logEntryResponseSchema = z.object({
  id: z.string(),
  projectId: z.string().uuid(),
  timestamp: dateSchema,
  level: z.enum(['debug', 'info', 'warn', 'error']),
  message: z.string(),
  traceId: z.string().optional(),
  spanId: z.string().optional(),
  attributes: z.record(z.unknown()).optional(),
});

export type LogEntryResponse = z.infer<typeof logEntryResponseSchema>;

/**
 * Metric response schema.
 */
export const metricResponseSchema = z.object({
  name: z.string(),
  type: z.enum(['counter', 'gauge', 'histogram']),
  value: z.number(),
  timestamp: dateSchema,
  attributes: z.record(z.unknown()).optional(),
});

export type MetricResponse = z.infer<typeof metricResponseSchema>;

/**
 * Aggregated metric response schema.
 */
export const aggregatedMetricResponseSchema = z.object({
  name: z.string(),
  aggregation: z.enum(['sum', 'avg', 'min', 'max', 'count', 'p50', 'p95', 'p99']),
  value: z.number(),
  startTime: dateSchema,
  endTime: dateSchema,
});

export type AggregatedMetricResponse = z.infer<typeof aggregatedMetricResponseSchema>;

/**
 * Score response schema.
 */
export const scoreResponseSchema = z.object({
  id: z.string(),
  projectId: z.string().uuid(),
  traceId: z.string().optional(),
  spanId: z.string().optional(),
  name: z.string(),
  value: z.number(),
  metadata: z.record(z.unknown()).optional(),
  createdAt: dateSchema,
});

export type ScoreResponse = z.infer<typeof scoreResponseSchema>;

/**
 * Query traces request params.
 */
export const queryTracesQuerySchema = paginationQuerySchema.merge(timeRangeQuerySchema).extend({
  name: z.string().optional(),
  status: z.enum(['ok', 'error', 'unset']).optional(),
  minDurationMs: z.coerce.number().nonnegative().optional(),
  maxDurationMs: z.coerce.number().nonnegative().optional(),
});

export type QueryTracesQuery = z.infer<typeof queryTracesQuerySchema>;

/**
 * Query logs request params.
 */
export const queryLogsQuerySchema = paginationQuerySchema.merge(timeRangeQuerySchema).extend({
  level: z.enum(['debug', 'info', 'warn', 'error']).optional(),
  search: z.string().optional(),
  traceId: z.string().optional(),
});

export type QueryLogsQuery = z.infer<typeof queryLogsQuerySchema>;

/**
 * Query metrics request params.
 */
export const queryMetricsQuerySchema = timeRangeQuerySchema.extend({
  name: z.string(),
  aggregation: z.enum(['sum', 'avg', 'min', 'max', 'count', 'p50', 'p95', 'p99']).optional().default('avg'),
  groupBy: z.string().optional(),
  interval: z.enum(['1m', '5m', '15m', '1h', '6h', '1d']).optional().default('1h'),
});

export type QueryMetricsQuery = z.infer<typeof queryMetricsQuerySchema>;

/**
 * Query scores request params.
 */
export const queryScoresQuerySchema = paginationQuerySchema.merge(timeRangeQuerySchema).extend({
  name: z.string().optional(),
  traceId: z.string().optional(),
  minValue: z.coerce.number().optional(),
  maxValue: z.coerce.number().optional(),
});

export type QueryScoresQuery = z.infer<typeof queryScoresQuerySchema>;
