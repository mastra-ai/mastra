import { z } from 'zod';
import {
  dateRangeSchema,
  dbTimestamps,
  entityIdField,
  entityNameField,
  entityTypeField,
  environmentField,
  experimentIdField,
  organizationIdField,
  parentEntityIdField,
  parentEntityNameField,
  parentEntityTypeField,
  requestIdField,
  resourceIdField,
  rootEntityIdField,
  rootEntityNameField,
  rootEntityTypeField,
  runIdField,
  serviceNameField,
  sessionIdField,
  sourceField,
  threadIdField,
  userIdField,
} from '../shared';
import { spanIdField, traceIdField } from './tracing';

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
const scopeField = z
  .record(z.unknown())
  .describe('Arbitrary package/app version info (e.g., {"core": "1.0.0", "memory": "1.0.0", "gitSha": "abcd1234"})');

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

    // Correlation
    traceId: traceIdField.nullish(),
    spanId: spanIdField.nullish(),

    // Entity (self)
    entityType: entityTypeField.nullish(),
    entityId: entityIdField.nullish(),
    entityName: entityNameField.nullish(),

    // Entity (parent)
    parentEntityType: parentEntityTypeField.nullish(),
    parentEntityId: parentEntityIdField.nullish(),
    parentEntityName: parentEntityNameField.nullish(),

    // Entity (root)
    rootEntityType: rootEntityTypeField.nullish(),
    rootEntityId: rootEntityIdField.nullish(),
    rootEntityName: rootEntityNameField.nullish(),

    // Identity & tenancy
    userId: userIdField.nullish(),
    organizationId: organizationIdField.nullish(),
    resourceId: resourceIdField.nullish(),

    // Correlation IDs
    runId: runIdField.nullish(),
    sessionId: sessionIdField.nullish(),
    threadId: threadIdField.nullish(),
    requestId: requestIdField.nullish(),

    // Deployment context
    environment: environmentField.nullish(),
    source: sourceField.nullish(),
    serviceName: serviceNameField.nullish(),
    scope: scopeField.nullish(),

    // Experimentation
    experimentId: experimentIdField.nullish(),

    // User-defined metadata
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
export const aggregationTypeSchema = z.enum(['sum', 'avg', 'min', 'max', 'count', 'last', 'rate']);
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

    // Correlation filters
    traceId: z.string().optional().describe('Filter by trace ID'),
    spanId: z.string().optional().describe('Filter by span ID'),

    // Entity filters
    entityType: entityTypeField.optional(),
    entityName: entityNameField.optional(),

    // Parent/root entity filters
    parentEntityType: parentEntityTypeField.optional(),
    parentEntityName: parentEntityNameField.optional(),
    rootEntityType: rootEntityTypeField.optional(),
    rootEntityName: rootEntityNameField.optional(),

    // Identity filters
    userId: userIdField.optional(),

    // Correlation ID filters
    runId: runIdField.optional(),
    sessionId: sessionIdField.optional(),

    // Experimentation
    experimentId: experimentIdField.optional(),

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
// OLAP Query Schemas
// ============================================================================

/** Compare period for aggregate queries with period-over-period comparison */
export const comparePeriodSchema = z
  .enum(['previous_period', 'previous_day', 'previous_week'])
  .describe('Comparison period for aggregate queries');

// --- getMetricAggregate ---

export const getMetricAggregateArgsSchema = z
  .object({
    name: z.union([z.string(), z.array(z.string())]).describe('Metric name(s) to aggregate'),
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
    name: z.union([z.string(), z.array(z.string())]).describe('Metric name(s) to break down'),
    groupBy: z.array(z.string()).min(1).describe('Fields to group by'),
    aggregation: aggregationTypeSchema.describe('Aggregation function'),
    filters: metricsFilterSchema.optional().describe('Optional filters'),
  })
  .describe('Arguments for getting a metric breakdown');

export type GetMetricBreakdownArgs = z.infer<typeof getMetricBreakdownArgsSchema>;

export const getMetricBreakdownResponseSchema = z.object({
  groups: z.array(
    z.object({
      dimensions: z.record(z.string()).describe('Dimension values for this group'),
      value: z.number().describe('Aggregated value for this group'),
    }),
  ),
});

export type GetMetricBreakdownResponse = z.infer<typeof getMetricBreakdownResponseSchema>;

// --- getMetricTimeSeries ---

export const getMetricTimeSeriesArgsSchema = z
  .object({
    name: z.union([z.string(), z.array(z.string())]).describe('Metric name(s)'),
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

// --- getMetricHistogram ---

export const getMetricHistogramArgsSchema = z
  .object({
    name: z.string().describe('Metric name'),
    bucketBoundaries: z.array(z.number()).describe('Bucket boundary values'),
    filters: metricsFilterSchema.optional().describe('Optional filters'),
  })
  .describe('Arguments for getting a metric histogram');

export type GetMetricHistogramArgs = z.infer<typeof getMetricHistogramArgsSchema>;

export const getMetricHistogramResponseSchema = z.object({
  boundaries: z.array(z.number()).describe('Bucket boundaries'),
  counts: z.array(z.number()).describe('Count of observations per bucket'),
  sum: z.number().describe('Sum of all values'),
  count: z.number().describe('Total count of observations'),
});

export type GetMetricHistogramResponse = z.infer<typeof getMetricHistogramResponseSchema>;

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

// --- getUsageReport (same shape as breakdown) ---

export const getUsageReportArgsSchema = z
  .object({
    name: z.union([z.string(), z.array(z.string())]).describe('Metric name(s)'),
    groupBy: z.array(z.string()).min(1).describe('Fields to group by'),
    aggregation: aggregationTypeSchema.describe('Aggregation function'),
    filters: metricsFilterSchema.optional().describe('Optional filters'),
  })
  .describe('Arguments for getting a usage report');

export type GetUsageReportArgs = z.infer<typeof getUsageReportArgsSchema>;

export const getUsageReportResponseSchema = z.object({
  groups: z.array(
    z.object({
      dimensions: z.record(z.string()).describe('Dimension values for this group'),
      value: z.number().describe('Aggregated value for this group'),
    }),
  ),
});

export type GetUsageReportResponse = z.infer<typeof getUsageReportResponseSchema>;

// ============================================================================
// Discovery / Metadata Schemas
// ============================================================================

// --- getMetricNames ---

export const getMetricNamesArgsSchema = z
  .object({
    prefix: z.string().optional().describe('Filter metric names by prefix'),
    limit: z.number().int().min(1).optional().describe('Maximum number of names to return'),
  })
  .describe('Arguments for getting metric names');

export type GetMetricNamesArgs = z.infer<typeof getMetricNamesArgsSchema>;

export const getMetricNamesResponseSchema = z.object({
  names: z.array(z.string()).describe('Distinct metric names'),
});

export type GetMetricNamesResponse = z.infer<typeof getMetricNamesResponseSchema>;

// --- getMetricLabelKeys ---

export const getMetricLabelKeysArgsSchema = z
  .object({
    metricName: z.string().describe('Metric name to get label keys for'),
  })
  .describe('Arguments for getting metric label keys');

export type GetMetricLabelKeysArgs = z.infer<typeof getMetricLabelKeysArgsSchema>;

export const getMetricLabelKeysResponseSchema = z.object({
  keys: z.array(z.string()).describe('Distinct label keys for the metric'),
});

export type GetMetricLabelKeysResponse = z.infer<typeof getMetricLabelKeysResponseSchema>;

// --- getLabelValues ---

export const getLabelValuesArgsSchema = z
  .object({
    metricName: z.string().describe('Metric name'),
    labelKey: z.string().describe('Label key to get values for'),
    prefix: z.string().optional().describe('Filter values by prefix'),
    limit: z.number().int().min(1).optional().describe('Maximum number of values to return'),
  })
  .describe('Arguments for getting label values');

export type GetLabelValuesArgs = z.infer<typeof getLabelValuesArgsSchema>;

export const getLabelValuesResponseSchema = z.object({
  values: z.array(z.string()).describe('Distinct label values'),
});

export type GetLabelValuesResponse = z.infer<typeof getLabelValuesResponseSchema>;

// --- getEntityTypes ---

export const getEntityTypesArgsSchema = z.object({}).describe('Arguments for getting entity types');

export type GetEntityTypesArgs = z.infer<typeof getEntityTypesArgsSchema>;

export const getEntityTypesResponseSchema = z.object({
  entityTypes: z.array(z.string()).describe('Distinct entity types'),
});

export type GetEntityTypesResponse = z.infer<typeof getEntityTypesResponseSchema>;

// --- getEntityNames ---

export const getEntityNamesArgsSchema = z
  .object({
    entityType: entityTypeField.optional().describe('Optional entity type filter'),
  })
  .describe('Arguments for getting entity names');

export type GetEntityNamesArgs = z.infer<typeof getEntityNamesArgsSchema>;

export const getEntityNamesResponseSchema = z.object({
  names: z.array(z.string()).describe('Distinct entity names'),
});

export type GetEntityNamesResponse = z.infer<typeof getEntityNamesResponseSchema>;

// --- getServiceNames ---

export const getServiceNamesArgsSchema = z.object({}).describe('Arguments for getting service names');

export type GetServiceNamesArgs = z.infer<typeof getServiceNamesArgsSchema>;

export const getServiceNamesResponseSchema = z.object({
  serviceNames: z.array(z.string()).describe('Distinct service names'),
});

export type GetServiceNamesResponse = z.infer<typeof getServiceNamesResponseSchema>;

// --- getEnvironments ---

export const getEnvironmentsArgsSchema = z.object({}).describe('Arguments for getting environments');

export type GetEnvironmentsArgs = z.infer<typeof getEnvironmentsArgsSchema>;

export const getEnvironmentsResponseSchema = z.object({
  environments: z.array(z.string()).describe('Distinct environments'),
});

export type GetEnvironmentsResponse = z.infer<typeof getEnvironmentsResponseSchema>;

// --- getTraceTags ---

export const getTraceTagsArgsSchema = z
  .object({
    entityType: entityTypeField.optional().describe('Optional entity type filter'),
  })
  .describe('Arguments for getting trace tags');

export type GetTraceTagsArgs = z.infer<typeof getTraceTagsArgsSchema>;

export const getTraceTagsResponseSchema = z.object({
  tags: z.array(z.string()).describe('Distinct trace tags'),
});

export type GetTraceTagsResponse = z.infer<typeof getTraceTagsResponseSchema>;
