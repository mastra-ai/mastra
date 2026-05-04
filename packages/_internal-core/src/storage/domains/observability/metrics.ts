import { z } from 'zod/v4';
import {
  aggregateResponseFields,
  aggregationIntervalSchema,
  aggregationTypeSchema,
  aggregatedValueField,
  bucketTimestampField,
  comparePeriodSchema,
  commonFilterFields,
  contextFields,
  dimensionsField,
  groupBySchema,
  paginationArgsSchema,
  paginationInfoSchema,
  percentileField,
  percentileBucketValueField,
  percentilesSchema,
  sortDirectionSchema,
  spanIdField,
  traceIdField,
  metadataField,
} from '../shared';
import type { AggregationType } from '../shared';

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
const providerField = z.string().describe('Model provider');
const modelField = z.string().describe('Model');
const estimatedCostField = z.number().describe('Estimated cost');
const costUnitField = z.string().describe('Unit for the estimated cost (e.g., usd)');
const costMetadField = z.record(z.string(), z.unknown()).nullish().describe('Structured costing metadata');

// ============================================================================
// MetricRecord Schema (Storage Format)
// ============================================================================

/**
 * Schema for metrics as stored in the database.
 * Each record is a single metric observation.
 */
export const metricRecordSchema = z
  .object({
    metricId: z.string().nullish().describe('Unique id for this metric event'),
    timestamp: z.date().describe('When the metric was recorded'),
    name: metricNameField,
    value: metricValueField,

    // Correlation
    traceId: traceIdField.nullish(),
    spanId: spanIdField.nullish(),

    // Context (entity hierarchy, identity, correlation, deployment, experimentation)
    ...contextFields,
    /**
     * @deprecated Use `executionSource` instead.
     */
    source: z.string().nullish().describe('Execution source'),

    // Canonical costing fields
    provider: providerField.nullish(),
    model: modelField.nullish(),

    // Estimated cost related fields
    estimatedCost: estimatedCostField.nullish(),
    costUnit: costUnitField.nullish(),
    costMetadata: costMetadField.nullish(),

    // User-defined labels used for filtering
    labels: labelsField.default({}),

    // User-defined metadata
    metadata: metadataField.nullish(),
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

/** Schema for metric aggregation configuration */
export const metricsAggregationSchema = z
  .object({
    type: aggregationTypeSchema,
    interval: aggregationIntervalSchema.optional(),
    groupBy: groupBySchema.optional(),
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

    /**
     * @deprecated Use `executionSource` instead.
     */
    source: z.string().optional().describe('Filter by execution source'),

    // Canonical costing filters
    provider: providerField.optional(),
    model: modelField.optional(),
    costUnit: costUnitField.optional(),

    // Label filters (exact match on label values)
    labels: z.record(z.string(), z.string()).optional().describe('Exact match on label key-value pairs'),
  })
  .describe('Filters for querying metrics');

/** Filters for querying metrics */
export type MetricsFilter = z.infer<typeof metricsFilterSchema>;

/** Fields available for ordering metric list results */
export const metricsOrderByFieldSchema = z.enum(['timestamp']).describe("Field to order by: 'timestamp'");

/** Order by configuration for metric list queries */
export const metricsOrderBySchema = z
  .object({
    field: metricsOrderByFieldSchema.default('timestamp').describe('Field to order by'),
    direction: sortDirectionSchema.default('DESC').describe('Sort direction'),
  })
  .describe('Order by configuration');

/** Schema for listMetrics operation arguments */
export const listMetricsArgsSchema = z
  .object({
    filters: metricsFilterSchema.optional(),
    pagination: paginationArgsSchema.default({ page: 0, perPage: 10 }).describe('Pagination settings'),
    orderBy: metricsOrderBySchema
      .default({ field: 'timestamp', direction: 'DESC' })
      .describe('Ordering configuration (defaults to timestamp desc)'),
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

// ============================================================================
// OLAP Query Schemas
// ============================================================================

/**
 * Columns eligible for `count_distinct`.
 *
 * Restricted to low/medium-cardinality categorical attributes. ID columns are
 * intentionally excluded — approximate distinct count over near-unique values
 * converges to the row count and is rarely a useful KPI.
 */
export const METRIC_DISTINCT_COLUMNS = [
  'entityType',
  'entityName',
  'parentEntityType',
  'parentEntityName',
  'rootEntityType',
  'rootEntityName',
  'name',
  'provider',
  'model',
  'environment',
  'executionSource',
  'serviceName',
] as const;

export type MetricDistinctColumn = (typeof METRIC_DISTINCT_COLUMNS)[number];

export const distinctColumnSchema = z
  .enum(METRIC_DISTINCT_COLUMNS)
  .optional()
  .describe(
    "Column to apply count_distinct over (required when aggregation is 'count_distinct'). Restricted to low/medium-cardinality categorical columns; ID columns are not allowed.",
  );

// --- getMetricAggregate ---

const requireDistinctColumnRefinement = {
  check: (data: { aggregation: AggregationType; distinctColumn?: string | undefined }) =>
    data.aggregation !== 'count_distinct' || data.distinctColumn !== undefined,
  options: {
    message: "distinctColumn is required when aggregation is 'count_distinct'",
    path: ['distinctColumn'],
  },
};

export const getMetricAggregateArgsSchema = z
  .object({
    name: z.array(z.string()).nonempty().describe('Metric name(s) to aggregate'),
    aggregation: aggregationTypeSchema,
    distinctColumn: distinctColumnSchema,
    filters: metricsFilterSchema.optional(),
    comparePeriod: comparePeriodSchema.optional(),
  })
  .refine(requireDistinctColumnRefinement.check, requireDistinctColumnRefinement.options)
  .describe('Arguments for getting a metric aggregate');

export type GetMetricAggregateArgs = z.infer<typeof getMetricAggregateArgsSchema>;

export const getMetricAggregateResponseSchema = z.object({
  ...aggregateResponseFields,
  estimatedCost: z.number().nullable().optional().describe('Aggregated estimated cost from the same filtered row set'),
  costUnit: z
    .string()
    .nullable()
    .optional()
    .describe('Shared cost unit for the aggregated rows, or null when mixed/unknown'),
  previousEstimatedCost: z
    .number()
    .nullable()
    .optional()
    .describe('Aggregated estimated cost from the comparison period'),
  costChangePercent: z
    .number()
    .nullable()
    .optional()
    .describe('Percentage change in estimated cost from comparison period'),
});

export type GetMetricAggregateResponse = z.infer<typeof getMetricAggregateResponseSchema>;

// --- getMetricBreakdown ---

export const getMetricBreakdownArgsSchema = z
  .object({
    name: z.array(z.string()).nonempty().describe('Metric name(s) to break down'),
    groupBy: groupBySchema,
    aggregation: aggregationTypeSchema,
    distinctColumn: distinctColumnSchema,
    filters: metricsFilterSchema.optional(),
    limit: z
      .number()
      .int()
      .positive()
      .max(1000)
      .optional()
      .describe('Maximum number of groups to return (server-side TopK). Required for high-cardinality groupBy.'),
    orderDirection: sortDirectionSchema
      .optional()
      .describe(
        "Sort direction for the aggregated value (defaults to 'DESC' at the storage layer; pairs with limit for top/bottom-N).",
      ),
  })
  .refine(requireDistinctColumnRefinement.check, requireDistinctColumnRefinement.options)
  .describe('Arguments for getting a metric breakdown');

export type GetMetricBreakdownArgs = z.infer<typeof getMetricBreakdownArgsSchema>;

export const getMetricBreakdownResponseSchema = z.object({
  groups: z.array(
    z.object({
      dimensions: dimensionsField,
      value: aggregatedValueField,
      estimatedCost: z.number().nullable().optional().describe('Summed estimated cost for this group'),
      costUnit: z
        .string()
        .nullable()
        .optional()
        .describe('Shared cost unit for this group, or null when mixed/unknown'),
    }),
  ),
});

export type GetMetricBreakdownResponse = z.infer<typeof getMetricBreakdownResponseSchema>;

// --- getMetricTimeSeries ---

export const getMetricTimeSeriesArgsSchema = z
  .object({
    name: z.array(z.string()).nonempty().describe('Metric name(s)'),
    interval: aggregationIntervalSchema,
    aggregation: aggregationTypeSchema,
    distinctColumn: distinctColumnSchema,
    filters: metricsFilterSchema.optional(),
    groupBy: groupBySchema.optional(),
  })
  .refine(requireDistinctColumnRefinement.check, requireDistinctColumnRefinement.options)
  .describe('Arguments for getting metric time series');

export type GetMetricTimeSeriesArgs = z.infer<typeof getMetricTimeSeriesArgsSchema>;

export const getMetricTimeSeriesResponseSchema = z.object({
  series: z.array(
    z.object({
      name: z.string().describe('Series name (metric name or group key)'),
      costUnit: z
        .string()
        .nullable()
        .optional()
        .describe('Shared cost unit for this series, or null when mixed/unknown'),
      points: z.array(
        z.object({
          timestamp: bucketTimestampField,
          value: aggregatedValueField,
          estimatedCost: z.number().nullable().optional().describe('Summed estimated cost in this bucket'),
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
    percentiles: percentilesSchema,
    interval: aggregationIntervalSchema,
    filters: metricsFilterSchema.optional(),
  })
  .describe('Arguments for getting metric percentiles');

export type GetMetricPercentilesArgs = z.infer<typeof getMetricPercentilesArgsSchema>;

export const getMetricPercentilesResponseSchema = z.object({
  series: z.array(
    z.object({
      percentile: percentileField,
      points: z.array(
        z.object({
          timestamp: bucketTimestampField,
          value: percentileBucketValueField,
        }),
      ),
    }),
  ),
});

export type GetMetricPercentilesResponse = z.infer<typeof getMetricPercentilesResponseSchema>;
