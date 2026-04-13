import { z } from 'zod/v4';

/** Types of entities that can produce observability spans. */
export enum EntityType {
  /** Agent/Model execution */
  AGENT = 'agent',
  /** Scorer definition/execution */
  SCORER = 'scorer',
  /** Trajectory evaluation target */
  TRAJECTORY = 'trajectory',
  /** Input Processor */
  INPUT_PROCESSOR = 'input_processor',
  /** Input Step Processor */
  INPUT_STEP_PROCESSOR = 'input_step_processor',
  /** Output Processor */
  OUTPUT_PROCESSOR = 'output_processor',
  /** Output Step Processor */
  OUTPUT_STEP_PROCESSOR = 'output_step_processor',
  /** Workflow Step */
  WORKFLOW_STEP = 'workflow_step',
  /** Tool */
  TOOL = 'tool',
  /** Workflow */
  WORKFLOW_RUN = 'workflow_run',
  /** Memory */
  MEMORY = 'memory',
}

/**
 * Common DB fields
 */
export const createdAtField = z.date().describe('Database record creation time');

export const updatedAtField = z.date().describe('Database record last update time');

export const dbTimestamps = {
  createdAt: createdAtField,
  updatedAt: updatedAtField.nullable(),
} as const satisfies z.ZodRawShape;

/**
 * Pagination arguments for list queries (page and perPage only)
 * Uses z.coerce to handle string → number conversion from query params
 */
export const paginationArgsSchema = z
  .object({
    page: z.coerce.number().int().min(0).optional().default(0).describe('Zero-indexed page number'),
    perPage: z.coerce.number().int().min(1).max(100).optional().default(10).describe('Number of items per page'),
  })
  .describe('Pagination options for list queries');

/** Input type for pagination arguments (page and perPage). */
export type PaginationArgs = z.input<typeof paginationArgsSchema>;

/**
 * Pagination response info
 * Used across all paginated endpoints
 */
export const paginationInfoSchema = z.object({
  total: z.number().describe('Total number of items available'),
  page: z.number().describe('Current page'),
  perPage: z
    .union([z.number(), z.literal(false)])
    .describe('Number of items per page, or false if pagination is disabled'),
  hasMore: z.boolean().describe('True if more pages are available'),
});

/**
 * Date range for filtering by time
 * Uses z.coerce to handle ISO string → Date conversion from query params
 */
export const dateRangeSchema = z
  .object({
    start: z.coerce.date().optional().describe('Start of date range (inclusive by default)'),
    end: z.coerce.date().optional().describe('End of date range (inclusive by default)'),
    startExclusive: z
      .boolean()
      .optional()
      .describe('When true, excludes the start date from results (uses > instead of >=)'),
    endExclusive: z
      .boolean()
      .optional()
      .describe('When true, excludes the end date from results (uses < instead of <=)'),
  })
  .describe('Date range filter for timestamps');

/** Date range with optional inclusive/exclusive boundaries. */
export type DateRange = z.input<typeof dateRangeSchema>;

export const sortDirectionSchema = z.enum(['ASC', 'DESC']).describe("Sort direction: 'ASC' | 'DESC'");

/** Aggregation type schema shared across OLAP-style observability queries. */
export const aggregationTypeSchema = z
  .enum(['sum', 'avg', 'min', 'max', 'count', 'last'])
  .describe('Aggregation function');
export type AggregationType = z.infer<typeof aggregationTypeSchema>;

/** Aggregation interval schema shared across OLAP-style observability queries. */
export const aggregationIntervalSchema = z.enum(['1m', '5m', '15m', '1h', '1d']).describe('Time bucket interval');
export type AggregationInterval = z.infer<typeof aggregationIntervalSchema>;

/** Compare period for aggregate queries with period-over-period comparison. */
export const comparePeriodSchema = z
  .enum(['previous_period', 'previous_day', 'previous_week'])
  .describe('Comparison period for aggregate queries');
export type ComparePeriod = z.infer<typeof comparePeriodSchema>;

/** Shared groupBy schema for OLAP-style breakdown and time-series queries. */
export const groupBySchema = z.array(z.string()).min(1).describe('Fields to group by');
export type GroupBy = z.infer<typeof groupBySchema>;

/** Shared percentiles schema for percentile queries. */
export const percentilesSchema = z.array(z.number().min(0).max(1)).min(1).describe('Percentile values (0-1)');
export type Percentiles = z.infer<typeof percentilesSchema>;

/** Shared fields for aggregate OLAP responses across observability signals. */
export const aggregateResponseFields = {
  value: z.number().nullable().describe('Aggregated value'),
  previousValue: z.number().nullable().optional().describe('Value from comparison period'),
  changePercent: z.number().nullable().optional().describe('Percentage change from comparison period'),
} as const;

/** Shared field for OLAP breakdown dimension values. */
export const dimensionsField = z.record(z.string(), z.string().nullable()).describe('Dimension values for this group');

/** Shared field for non-null OLAP aggregated values. */
export const aggregatedValueField = z.number().describe('Aggregated value');

/** Shared field for OLAP bucket timestamps. */
export const bucketTimestampField = z.date().describe('Bucket timestamp');

/** Shared field for percentile identifiers in OLAP responses. */
export const percentileField = z.number().describe('Percentile value');

/** Shared field for percentile values within a time bucket. */
export const percentileBucketValueField = z.number().describe('Percentile value at this bucket');

export const entityTypeField = z
  .nativeEnum(EntityType)
  .describe(`Entity type (e.g., 'agent' | 'processor' | 'tool' | 'workflow')`);

export const entityIdField = z.string().describe('ID of the entity (e.g., "weatherAgent", "orderWorkflow")');

export const entityNameField = z.string().describe('Name of the entity');

export const userIdField = z.string().describe('Human end-user who triggered execution');

export const organizationIdField = z.string().describe('Multi-tenant organization/account');

export const resourceIdField = z.string().describe('Broader resource context (Mastra memory compatibility)');

export const runIdField = z.string().describe('Unique execution run identifier');

export const sessionIdField = z.string().describe('Session identifier for grouping traces');

export const threadIdField = z.string().describe('Conversation thread identifier');

export const requestIdField = z.string().describe('HTTP request ID for log correlation');

export const environmentField = z.string().describe(`Environment (e.g., "production" | "staging" | "development")`);

export const sourceField = z.string().describe(`Source of execution (e.g., "local" | "cloud" | "ci")`);
export const executionSourceField = z.string().describe(`Source of execution (e.g., "local" | "cloud" | "ci")`);

export const serviceNameField = z.string().describe('Name of the service');

// Parent entity hierarchy fields
export const parentEntityTypeField = z.nativeEnum(EntityType).describe('Entity type of the parent entity');
export const parentEntityIdField = z.string().describe('ID of the parent entity');
export const parentEntityNameField = z.string().describe('Name of the parent entity');

// Root entity hierarchy fields
export const rootEntityTypeField = z.nativeEnum(EntityType).describe('Entity type of the root entity');
export const rootEntityIdField = z.string().describe('ID of the root entity');
export const rootEntityNameField = z.string().describe('Name of the root entity');

// Experimentation
export const experimentIdField = z.string().describe('Experiment or eval run identifier');

// ============================================================================
// Common observability fields (shared across tracing, metrics, logs)
// ============================================================================

export const scopeField = z
  .record(z.string(), z.unknown())
  .describe('Arbitrary package/app version info (e.g., {"core": "1.0.0", "memory": "1.0.0", "gitSha": "abcd1234"})');

export const metadataField = z.record(z.string(), z.unknown()).describe('User-defined metadata for custom filtering');

export const tagsField = z.array(z.string()).describe('Labels for filtering');

/**
 * Base context fields shared across tracing and non-tracing observability records.
 * Source/provenance is intentionally excluded because tracing uses `source`
 * while signals use `executionSource`.
 */
const contextFieldsBase = {
  // Entity identification
  entityType: entityTypeField.nullish(),
  entityId: entityIdField.nullish(),
  entityName: entityNameField.nullish(),

  // Parent entity hierarchy
  parentEntityType: parentEntityTypeField.nullish(),
  parentEntityId: parentEntityIdField.nullish(),
  parentEntityName: parentEntityNameField.nullish(),

  // Root entity hierarchy
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
  serviceName: serviceNameField.nullish(),
  scope: scopeField.nullish(),

  // Experimentation
  experimentId: experimentIdField.nullish(),
} as const;

/**
 * Context fields shared across observability signals other than spans (metrics, logs, scores, feedback).
 * These use `executionSource` to avoid colliding with signal-specific provenance fields.
 */
export const contextFields = {
  ...contextFieldsBase,
  executionSource: executionSourceField.nullish(),
  tags: tagsField.nullish(),
} as const;

/**
 * Context fields used by tracing/span records.
 * Tracing continues to expose execution provenance as `source`.
 */
export const spanContextFields = {
  ...contextFieldsBase,
  source: sourceField.nullish(),
} as const;

/**
 * Common filter fields shared across observability signal filters (metrics, logs, scores, feedback).
 * All fields are optional — each signal extends this with signal-specific filters.
 */
export const commonFilterFields = {
  timestamp: dateRangeSchema.optional().describe('Filter by timestamp range'),
  traceId: z.string().optional().describe('Filter by trace ID'),
  spanId: z.string().optional().describe('Filter by span ID'),
  entityType: entityTypeField.optional(),
  entityName: entityNameField.optional(),
  userId: userIdField.optional(),
  organizationId: organizationIdField.optional(),
  experimentId: experimentIdField.optional(),
  serviceName: serviceNameField.optional(),
  environment: environmentField.optional(),
  parentEntityType: parentEntityTypeField.optional(),
  parentEntityName: parentEntityNameField.optional(),
  rootEntityType: rootEntityTypeField.optional(),
  rootEntityName: rootEntityNameField.optional(),
  resourceId: resourceIdField.optional(),
  runId: runIdField.optional(),
  sessionId: sessionIdField.optional(),
  threadId: threadIdField.optional(),
  requestId: requestIdField.optional(),
  executionSource: executionSourceField.optional(),
  tags: z.array(z.string()).optional().describe('Filter by tags (must have all specified tags)'),
} as const;

// ============================================================================
// Tracing identifier fields (shared across scores, feedback, metrics)
// ============================================================================

/** Zod schema for trace ID field */
export const traceIdField = z.string().describe('Unique trace identifier');

/** Zod schema for span ID field */
export const spanIdField = z.string().describe('Unique span identifier within a trace');
