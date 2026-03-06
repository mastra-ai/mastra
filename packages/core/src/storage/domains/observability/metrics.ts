import { z } from 'zod';
import {
  dateRangeSchema,
  dbTimestamps,
  environmentField,
  organizationIdField,
  paginationArgsSchema,
  paginationInfoSchema,
  serviceNameField,
  sortDirectionSchema,
} from '../shared';

// ============================================================================
// Helper utilities
// ============================================================================

const createOmitKeys = <T extends z.ZodRawShape>(shape: T): { [K in keyof T]: true } =>
  Object.fromEntries(Object.keys(shape).map(k => [k, true])) as { [K in keyof T]: true };

const omitDbTimestamps = createOmitKeys(dbTimestamps);

// ============================================================================
// Field Schemas
// ============================================================================

/** Metric type schema for validation */
export const metricTypeSchema = z.enum(['counter', 'gauge', 'histogram']);

const metricNameField = z.string().describe('Metric name (e.g., mastra_agent_duration_ms)');
const metricValueField = z.number().describe('Metric value');
const labelsField = z.record(z.string()).describe('Metric labels for dimensional filtering');

// ============================================================================
// MetricRecord Schema (Storage Format)
// ============================================================================

/**
 * Schema for metrics as stored in the database.
 * Each record is a single metric observation.
 *
 * Note: Histogram aggregation (bucket counts, sum, count) is computed at
 * query time from raw observations, not stored per-record.
 */
export const metricRecordSchema = z
  .object({
    id: z.string().describe('Unique metric record identifier'),
    timestamp: z.date().describe('When the metric was recorded'),
    name: metricNameField,
    metricType: metricTypeSchema.describe('Type of metric'),
    value: metricValueField.describe('Single observation value'),
    labels: labelsField.default({}),

    // User-defined metadata (environment fields stored here)
    metadata: z.record(z.unknown()).nullish().describe('User-defined metadata'),

    // Database timestamps
    ...dbTimestamps,
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
    metricType: metricTypeSchema,
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
export const createMetricRecordSchema = metricRecordSchema.omit(omitDbTimestamps);

/** Metric record for creation (excludes db timestamps) */
export type CreateMetricRecord = z.infer<typeof createMetricRecordSchema>;

/** Schema for batchRecordMetrics operation arguments */
export const batchRecordMetricsArgsSchema = z
  .object({
    metrics: z.array(createMetricRecordSchema),
  })
  .describe('Arguments for batch recording metrics');

/** Arguments for batch recording metrics */
export type BatchRecordMetricsArgs = z.infer<typeof batchRecordMetricsArgsSchema>;

// ============================================================================
// Metric Aggregation Schemas
// ============================================================================

/** Aggregation type schema */
export const aggregationTypeSchema = z.enum(['sum', 'avg', 'min', 'max', 'count']);
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

/** Schema for filtering metrics in list queries */
export const metricsFilterSchema = z
  .object({
    // Date range
    timestamp: dateRangeSchema.optional().describe('Filter by metric timestamp range'),

    // Metric identification
    name: z
      .union([z.string(), z.array(z.string())])
      .optional()
      .describe('Filter by metric name(s)'),
    metricType: z
      .union([metricTypeSchema, z.array(metricTypeSchema)])
      .optional()
      .describe('Filter by metric type(s)'),

    // Environment filters
    organizationId: organizationIdField.optional(),
    serviceName: serviceNameField.optional(),
    environment: environmentField.optional(),

    // Label filters (exact match on label values)
    labels: z.record(z.string()).optional().describe('Exact match on label key-value pairs'),
  })
  .describe('Filters for querying metrics');

/** Filters for querying metrics */
export type MetricsFilter = z.infer<typeof metricsFilterSchema>;

// ============================================================================
// List Metrics Schemas
// ============================================================================

/** Fields available for ordering metric results */
export const metricsOrderByFieldSchema = z
  .enum(['timestamp', 'name'])
  .describe("Field to order by: 'timestamp' | 'name'");

/** Order by configuration for metric queries */
export const metricsOrderBySchema = z
  .object({
    field: metricsOrderByFieldSchema.default('timestamp').describe('Field to order by'),
    direction: sortDirectionSchema.default('DESC').describe('Sort direction'),
  })
  .describe('Order by configuration');

/** Schema for listMetrics operation arguments */
export const listMetricsArgsSchema = z
  .object({
    filters: metricsFilterSchema.optional().describe('Optional filters to apply'),
    pagination: paginationArgsSchema.default({}).describe('Pagination settings'),
    orderBy: metricsOrderBySchema.default({}).describe('Ordering configuration (defaults to timestamp desc)'),
    aggregation: metricsAggregationSchema.optional().describe('Optional aggregation configuration'),
  })
  .describe('Arguments for listing metrics');

/** Arguments for listing metrics */
export type ListMetricsArgs = z.input<typeof listMetricsArgsSchema>;

/** Schema for listMetrics operation response */
export const listMetricsResponseSchema = z.object({
  pagination: paginationInfoSchema,
  metrics: z.array(metricRecordSchema),
});

/** Response containing paginated metrics */
export type ListMetricsResponse = z.infer<typeof listMetricsResponseSchema>;
