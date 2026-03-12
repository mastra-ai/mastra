import { z } from 'zod/v4';
import {
  commonFilterFields,
  contextFields,
  parentEntityNameField,
  parentEntityTypeField,
  rootEntityNameField,
  rootEntityTypeField,
  runIdField,
  sessionIdField,
} from '../shared';
import { spanIdField, traceIdField } from './tracing';

// ============================================================================
// Field Schemas
// ============================================================================

/**
 * @deprecated MetricType is no longer stored. All metrics are raw events
 * with aggregation determined at query time.
 */
export const metricTypeSchema = z.enum(['counter', 'gauge', 'histogram']);

const metricNameField = z.string().describe('Metric name (e.g., mastra_agent_duration_ms)');
const metricValueField = z.number().describe('Metric value');
const labelsField = z.record(z.string(), z.string()).describe('Metric labels for dimensional filtering');

// ============================================================================
// MetricRecord Schema (Storage Format)
// ============================================================================

/**
 * Schema for metrics as stored in the database.
 * Each record is a single metric observation.
 */
export const metricRecordSchema = z
  .object({
    timestamp: z.date().describe('When the metric was recorded'),
    name: metricNameField,
    value: metricValueField.describe('Single observation value'),
    labels: labelsField.default({}),

    // Correlation
    traceId: traceIdField.nullish(),
    spanId: spanIdField.nullish(),

    // Context (entity hierarchy, identity, correlation, deployment, experimentation)
    ...contextFields,

    // User-defined metadata
    metadata: z.record(z.string(), z.unknown()).nullish().describe('User-defined metadata'),
  })
  .describe('Metric record as stored in the database');

/** Metric record type for storage */
export type MetricRecord = z.infer<typeof metricRecordSchema>;

// ============================================================================
// MetricInput Schema (User-Facing API)
// ============================================================================

/**
 * Schema for user-provided metric input (minimal required fields).
 * The metrics context enriches this with environment before emitting ExportedMetric.
 */
export const metricInputSchema = z
  .object({
    name: metricNameField,
    value: metricValueField,
    labels: labelsField.optional(),
  })
  .describe('User-provided metric input');

/** User-facing metric input type */
export type MetricInput = z.infer<typeof metricInputSchema>;

// ============================================================================
// Create Metric Schemas
// ============================================================================

/** Schema for creating a metric record (without db timestamps) */
export const createMetricRecordSchema = metricRecordSchema;

/** Metric record for creation (excludes db timestamps) */
export type CreateMetricRecord = z.infer<typeof createMetricRecordSchema>;

/** Schema for batchCreateMetrics operation arguments */
export const batchCreateMetricsArgsSchema = z
  .object({
    metrics: z.array(createMetricRecordSchema),
  })
  .describe('Arguments for batch recording metrics');

/** Arguments for batch recording metrics */
export type BatchCreateMetricsArgs = z.infer<typeof batchCreateMetricsArgsSchema>;

// ============================================================================
// Metric Aggregation Schemas
// ============================================================================

/** Aggregation type schema */
export const aggregationTypeSchema = z.enum(['sum', 'avg', 'min', 'max', 'count', 'last']);
export type AggregationType = z.infer<typeof aggregationTypeSchema>;

/** Aggregation interval schema */
export const aggregationIntervalSchema = z.enum(['1m', '5m', '15m', '1h', '1d']);
export type AggregationInterval = z.infer<typeof aggregationIntervalSchema>;

/** Schema for metric aggregation configuration */
export const metricsAggregationSchema = z
  .object({
    type: aggregationTypeSchema.describe('Aggregation function'),
    interval: aggregationIntervalSchema.optional().describe('Time bucket interval'),
    groupBy: z.array(z.string()).optional().describe('Label keys to group by'),
  })
  .describe('Metrics aggregation configuration');

/** Metrics aggregation configuration type */
export type MetricsAggregation = z.infer<typeof metricsAggregationSchema>;

// ============================================================================
// Metric Filter Schema
// ============================================================================

/** Schema for filtering metrics in queries */
export const metricsFilterSchema = z
  .object({
    ...commonFilterFields,

    // Metric identification
    name: z.array(z.string()).nonempty().optional().describe('Filter by metric name(s)'),

    // Parent/root entity filters
    parentEntityType: parentEntityTypeField.optional(),
    parentEntityName: parentEntityNameField.optional(),
    rootEntityType: rootEntityTypeField.optional(),
    rootEntityName: rootEntityNameField.optional(),

    // Correlation ID filters
    runId: runIdField.optional(),
    sessionId: sessionIdField.optional(),

    // Label filters (exact match on label values)
    labels: z.record(z.string(), z.string()).optional().describe('Exact match on label key-value pairs'),
  })
  .describe('Filters for querying metrics');

/** Filters for querying metrics */
export type MetricsFilter = z.infer<typeof metricsFilterSchema>;

// ============================================================================
// OLAP Query Schemas
// ============================================================================

/** Compare period for aggregate queries with period-over-period comparison */
export const comparePeriodSchema = z
  .enum(['previous_period', 'previous_day', 'previous_week'])
  .describe('Comparison period for aggregate queries');

// --- getMetricAggregate ---

export const getMetricAggregateArgsSchema = z
  .object({
    name: z.array(z.string()).nonempty().describe('Metric name(s) to aggregate'),
    aggregation: aggregationTypeSchema.describe('Aggregation function'),
    filters: metricsFilterSchema.optional().describe('Optional filters'),
    comparePeriod: comparePeriodSchema.optional().describe('Optional comparison period'),
  })
  .describe('Arguments for getting a metric aggregate');

export type GetMetricAggregateArgs = z.infer<typeof getMetricAggregateArgsSchema>;

export const getMetricAggregateResponseSchema = z.object({
  value: z.number().nullable().describe('Aggregated value'),
  previousValue: z.number().nullable().optional().describe('Value from comparison period'),
  changePercent: z.number().nullable().optional().describe('Percentage change from comparison period'),
});

export type GetMetricAggregateResponse = z.infer<typeof getMetricAggregateResponseSchema>;

// --- getMetricBreakdown ---

export const getMetricBreakdownArgsSchema = z
  .object({
    name: z.array(z.string()).nonempty().describe('Metric name(s) to break down'),
    groupBy: z.array(z.string()).min(1).describe('Fields to group by'),
    aggregation: aggregationTypeSchema.describe('Aggregation function'),
    filters: metricsFilterSchema.optional().describe('Optional filters'),
  })
  .describe('Arguments for getting a metric breakdown');

export type GetMetricBreakdownArgs = z.infer<typeof getMetricBreakdownArgsSchema>;

export const getMetricBreakdownResponseSchema = z.object({
  groups: z.array(
    z.object({
      dimensions: z.record(z.string(), z.string().nullable()).describe('Dimension values for this group'),
      value: z.number().describe('Aggregated value for this group'),
    }),
  ),
});

export type GetMetricBreakdownResponse = z.infer<typeof getMetricBreakdownResponseSchema>;

// --- getMetricTimeSeries ---

export const getMetricTimeSeriesArgsSchema = z
  .object({
    name: z.array(z.string()).nonempty().describe('Metric name(s)'),
    interval: aggregationIntervalSchema.describe('Time bucket interval'),
    aggregation: aggregationTypeSchema.describe('Aggregation function'),
    filters: metricsFilterSchema.optional().describe('Optional filters'),
    groupBy: z.array(z.string()).optional().describe('Optional fields to group by'),
  })
  .describe('Arguments for getting metric time series');

export type GetMetricTimeSeriesArgs = z.infer<typeof getMetricTimeSeriesArgsSchema>;

export const getMetricTimeSeriesResponseSchema = z.object({
  series: z.array(
    z.object({
      name: z.string().describe('Series name (metric name or group key)'),
      points: z.array(
        z.object({
          timestamp: z.date().describe('Bucket timestamp'),
          value: z.number().describe('Aggregated value'),
        }),
      ),
    }),
  ),
});

export type GetMetricTimeSeriesResponse = z.infer<typeof getMetricTimeSeriesResponseSchema>;

// --- getMetricPercentiles ---

export const getMetricPercentilesArgsSchema = z
  .object({
    name: z.string().describe('Metric name'),
    percentiles: z.array(z.number().min(0).max(1)).describe('Percentile values (0-1)'),
    interval: aggregationIntervalSchema.describe('Time bucket interval'),
    filters: metricsFilterSchema.optional().describe('Optional filters'),
  })
  .describe('Arguments for getting metric percentiles');

export type GetMetricPercentilesArgs = z.infer<typeof getMetricPercentilesArgsSchema>;

export const getMetricPercentilesResponseSchema = z.object({
  series: z.array(
    z.object({
      percentile: z.number().describe('Percentile value'),
      points: z.array(
        z.object({
          timestamp: z.date().describe('Bucket timestamp'),
          value: z.number().describe('Percentile value at this bucket'),
        }),
      ),
    }),
  ),
});

export type GetMetricPercentilesResponse = z.infer<typeof getMetricPercentilesResponseSchema>;
