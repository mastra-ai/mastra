# PR 6.0: Storage Schemas

**Package:** `packages/core`
**Scope:** Record schemas and storage operation schemas for all signals (logs, metrics, scores, feedback)

This PR defines:
1. **Input schemas** - User-facing API types (LogRecordInput, MetricInput, ScoreInput, FeedbackInput)
2. **Record schemas** - Storage format types (LogRecord, MetricRecord, ScoreRecord, FeedbackRecord)
3. **Operation schemas** - Filter, list, and create schemas for storage operations

These schemas enable:
- Exported → Record conversion in DefaultExporter
- API request/response validation
- Type-safe storage operations
- Consistent filter patterns across all signals

---

## 6.0.1 Log Record & Storage Schemas

**File:** `packages/core/src/storage/domains/observability/logs.ts` (new)

```typescript
import { z } from 'zod';
import { dateRangeSchema, paginationArgsSchema, paginationInfoSchema, sortDirectionSchema, dbTimestamps } from '../shared';
import type { LogLevel } from '../../../observability/types/logging';

// ============================================================================
// Field Schemas (Zod versions for storage/API validation)
// ============================================================================

/** Log level schema for validation */
export const logLevelSchema = z.enum(['debug', 'info', 'warn', 'error', 'fatal']);

/** Log message field */
const messageField = z.string().describe('Log message');

/** Structured data field */
const logDataField = z.record(z.unknown()).describe('Structured data attached to the log');

/** Log tags field */
const logTagsField = z.array(z.string()).describe('Labels for filtering logs');

// ============================================================================
// LogRecord Schema (Storage Format)
// ============================================================================

/**
 * Schema for logs as stored in the database.
 * Includes all fields from ExportedLog plus storage-specific fields.
 */
export const logRecordSchema = z
  .object({
    id: z.string().describe('Unique log record identifier'),
    timestamp: z.date().describe('When the log was created'),
    level: logLevelSchema.describe('Log severity level'),
    message: messageField,
    data: logDataField.nullish(),

    // Correlation
    traceId: z.string().nullish().describe('Trace ID for correlation'),
    spanId: z.string().nullish().describe('Span ID for correlation'),

    // Filtering
    tags: logTagsField.nullish(),

    // User-defined metadata (context fields stored here)
    metadata: z.record(z.unknown()).nullish().describe('User-defined metadata'),

    // Database timestamps
    ...dbTimestamps,
  })
  .describe('Log record as stored in the database');

/** Log record type for storage */
export type LogRecord = z.infer<typeof logRecordSchema>;

// ============================================================================
// LogRecordInput Schema (User-Facing API)
// ============================================================================

/**
 * Schema for user-provided log input (minimal required fields).
 * The logger enriches this with context before emitting ExportedLog.
 */
export const logRecordInputSchema = z
  .object({
    level: logLevelSchema,
    message: messageField,
    data: logDataField.optional(),
    tags: logTagsField.optional(),
  })
  .describe('User-provided log input');

/** User-facing log input type */
export type LogRecordInput = z.infer<typeof logRecordInputSchema>;

// ============================================================================
// Create Log Schemas
// ============================================================================

/** Schema for creating a log record (without db timestamps) */
export const createLogRecordSchema = logRecordSchema.omit({
  createdAt: true,
  updatedAt: true,
});

/** Log record for creation (excludes db timestamps) */
export type CreateLogRecord = z.infer<typeof createLogRecordSchema>;

/** Schema for batchCreateLogs operation arguments */
export const batchCreateLogsArgsSchema = z
  .object({
    logs: z.array(createLogRecordSchema),
  })
  .describe('Arguments for batch creating logs');

/** Arguments for batch creating logs */
export type BatchCreateLogsArgs = z.infer<typeof batchCreateLogsArgsSchema>;

// ============================================================================
// Log Filter Schema
// ============================================================================

/** Schema for filtering logs in list queries */
export const logsFilterSchema = z
  .object({
    // Date range
    timestamp: dateRangeSchema.optional().describe('Filter by log timestamp range'),

    // Level filtering
    level: z.union([logLevelSchema, z.array(logLevelSchema)]).optional().describe('Filter by log level(s)'),

    // Correlation filters
    traceId: z.string().optional().describe('Filter by trace ID'),
    spanId: z.string().optional().describe('Filter by span ID'),
    runId: z.string().optional().describe('Filter by run ID'),
    sessionId: z.string().optional().describe('Filter by session ID'),
    threadId: z.string().optional().describe('Filter by thread ID'),
    requestId: z.string().optional().describe('Filter by request ID'),

    // Entity filters
    entityType: z.string().optional().describe('Filter by entity type (e.g., agent, workflow, tool)'),
    entityName: z.string().optional().describe('Filter by entity name'),

    // Multi-tenancy filters
    userId: z.string().optional().describe('Filter by user ID'),
    organizationId: z.string().optional().describe('Filter by organization ID'),
    resourceId: z.string().optional().describe('Filter by resource ID'),

    // Environment filters
    serviceName: z.string().optional().describe('Filter by service name'),
    environment: z.string().optional().describe('Filter by environment (e.g., production, staging)'),
    source: z.string().optional().describe('Filter by log source'),

    // Content filters
    search: z.string().optional().describe('Full-text search on message'),
    tags: z.array(z.string()).optional().describe('Filter by tags (logs must have all specified tags)'),
    dataKeys: z.array(z.string()).optional().describe('Filter logs that have specific data keys'),
  })
  .describe('Filters for querying logs');

/** Filters for querying logs */
export type LogsFilter = z.infer<typeof logsFilterSchema>;

// ============================================================================
// List Logs Schemas
// ============================================================================

/** Fields available for ordering log results */
export const logsOrderByFieldSchema = z
  .enum(['timestamp'])
  .describe("Field to order by: 'timestamp'");

/** Order by configuration for log queries */
export const logsOrderBySchema = z
  .object({
    field: logsOrderByFieldSchema.default('timestamp').describe('Field to order by'),
    direction: sortDirectionSchema.default('DESC').describe('Sort direction'),
  })
  .describe('Order by configuration');

/** Schema for listLogs operation arguments */
export const listLogsArgsSchema = z
  .object({
    filters: logsFilterSchema.optional().describe('Optional filters to apply'),
    pagination: paginationArgsSchema.default({}).describe('Pagination settings'),
    orderBy: logsOrderBySchema.default({}).describe('Ordering configuration (defaults to timestamp desc)'),
  })
  .describe('Arguments for listing logs');

/** Arguments for listing logs */
export type ListLogsArgs = z.input<typeof listLogsArgsSchema>;

/** Schema for listLogs operation response */
export const listLogsResponseSchema = z.object({
  pagination: paginationInfoSchema,
  logs: z.array(logRecordSchema),
});

/** Response containing paginated logs */
export type ListLogsResponse = z.infer<typeof listLogsResponseSchema>;
```

**Tasks:**
- [ ] Define `logRecordSchema` (storage format)
- [ ] Define `logRecordInputSchema` (user API)
- [ ] Define `createLogRecordSchema` (excludes db timestamps)
- [ ] Define `batchCreateLogsArgsSchema`
- [ ] Define `logsFilterSchema` with all filter options
- [ ] Define `logsOrderBySchema`
- [ ] Define `listLogsArgsSchema`
- [ ] Define `listLogsResponseSchema`

---

## 6.0.2 Metric Record & Storage Schemas

**File:** `packages/core/src/storage/domains/observability/metrics.ts` (new)

```typescript
import { z } from 'zod';
import { dateRangeSchema, paginationArgsSchema, paginationInfoSchema, sortDirectionSchema, dbTimestamps } from '../shared';
import type { MetricType } from '../../../observability/types/metrics';

// ============================================================================
// Field Schemas (Zod versions for storage/API validation)
// ============================================================================

/** Metric type schema for validation */
export const metricTypeSchema = z.enum(['counter', 'gauge', 'histogram']);

/** Metric name field */
const metricNameField = z.string().describe('Metric name (e.g., mastra_agent_duration_ms)');

/** Metric value field */
const metricValueField = z.number().describe('Metric value');

/** Metric labels field */
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
export const createMetricRecordSchema = metricRecordSchema.omit({
  createdAt: true,
  updatedAt: true,
});

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
    name: z.union([z.string(), z.array(z.string())]).optional().describe('Filter by metric name(s)'),
    metricType: z.union([metricTypeSchema, z.array(metricTypeSchema)]).optional().describe('Filter by metric type(s)'),

    // Environment filters
    organizationId: z.string().optional().describe('Filter by organization ID'),
    serviceName: z.string().optional().describe('Filter by service name'),
    environment: z.string().optional().describe('Filter by environment (e.g., production, staging)'),

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
```

**Tasks:**
- [ ] Define `metricRecordSchema` (storage format)
- [ ] Define `metricInputSchema` (user API)
- [ ] Define `createMetricRecordSchema` (excludes db timestamps)
- [ ] Define `batchRecordMetricsArgsSchema`
- [ ] Define aggregation schemas
- [ ] Define `metricsFilterSchema` with all filter options
- [ ] Define `metricsOrderBySchema`
- [ ] Define `listMetricsArgsSchema`
- [ ] Define `listMetricsResponseSchema`

---

## 6.0.3 Score Record & Storage Schemas

**File:** `packages/core/src/storage/domains/observability/scores.ts` (new)

```typescript
import { z } from 'zod';
import { dateRangeSchema, paginationArgsSchema, paginationInfoSchema, sortDirectionSchema, dbTimestamps } from '../shared';

// ============================================================================
// Field Schemas (Zod versions for storage/API validation)
// ============================================================================

/** Scorer name field */
const scorerNameField = z.string().describe('Name of the scorer (e.g., relevance, accuracy)');

/** Score value field */
const scoreValueField = z.number().describe('Score value (range defined by scorer)');

/** Score reason field */
const scoreReasonField = z.string().describe('Explanation for the score');

/** Experiment field */
const experimentField = z.string().describe('Experiment or eval run identifier');

// ============================================================================
// ScoreRecord Schema (Storage Format)
// ============================================================================

/**
 * Schema for scores as stored in the database.
 * Includes all fields from ExportedScore plus storage-specific fields.
 */
export const scoreRecordSchema = z
  .object({
    id: z.string().describe('Unique score record identifier'),
    timestamp: z.date().describe('When the score was recorded'),

    // Target
    traceId: z.string().describe('Trace ID this score applies to'),
    spanId: z.string().nullish().describe('Span ID this score applies to'),

    // Score data
    scorerName: scorerNameField,
    score: scoreValueField,
    reason: scoreReasonField.nullish(),
    experiment: experimentField.nullish(),

    // User-defined metadata (context fields stored here)
    metadata: z.record(z.unknown()).nullish().describe('User-defined metadata'),

    // Database timestamps
    ...dbTimestamps,
  })
  .describe('Score record as stored in the database');

/** Score record type for storage */
export type ScoreRecord = z.infer<typeof scoreRecordSchema>;

// ============================================================================
// ScoreInput Schema (User-Facing API)
// ============================================================================

/**
 * Schema for user-provided score input (minimal required fields).
 * The span/trace context adds traceId/spanId before emitting ExportedScore.
 */
export const scoreInputSchema = z
  .object({
    scorerName: scorerNameField,
    score: scoreValueField,
    reason: scoreReasonField.optional(),
    metadata: z.record(z.unknown()).optional().describe('Additional scorer-specific metadata'),
    experiment: experimentField.optional(),
  })
  .describe('User-provided score input');

/** User-facing score input type */
export type ScoreInput = z.infer<typeof scoreInputSchema>;

// ============================================================================
// Create Score Schemas
// ============================================================================

/** Schema for creating a score record (without db timestamps) */
export const createScoreRecordSchema = scoreRecordSchema.omit({
  createdAt: true,
  updatedAt: true,
});

/** Score record for creation (excludes db timestamps) */
export type CreateScoreRecord = z.infer<typeof createScoreRecordSchema>;

/** Schema for createScore operation arguments */
export const createScoreArgsSchema = z
  .object({
    score: createScoreRecordSchema,
  })
  .describe('Arguments for creating a score');

/** Arguments for creating a score */
export type CreateScoreArgs = z.infer<typeof createScoreArgsSchema>;

// ============================================================================
// Score Filter Schema
// ============================================================================

/** Schema for filtering scores in list queries */
export const scoresFilterSchema = z
  .object({
    // Date range
    timestamp: dateRangeSchema.optional().describe('Filter by score timestamp range'),

    // Target filters
    traceId: z.string().optional().describe('Filter by trace ID'),
    spanId: z.string().optional().describe('Filter by span ID'),

    // Score filters
    scorerName: z.union([z.string(), z.array(z.string())]).optional().describe('Filter by scorer name(s)'),
    experiment: z.string().optional().describe('Filter by experiment or eval run identifier'),

    // Multi-tenancy filters
    organizationId: z.string().optional().describe('Filter by organization ID'),
    userId: z.string().optional().describe('Filter by user ID who created the score'),

    // Environment filters
    serviceName: z.string().optional().describe('Filter by service name'),
    environment: z.string().optional().describe('Filter by environment (e.g., production, staging)'),
  })
  .describe('Filters for querying scores');

/** Filters for querying scores */
export type ScoresFilter = z.infer<typeof scoresFilterSchema>;

// ============================================================================
// List Scores Schemas
// ============================================================================

/** Fields available for ordering score results */
export const scoresOrderByFieldSchema = z
  .enum(['timestamp', 'score'])
  .describe("Field to order by: 'timestamp' | 'score'");

/** Order by configuration for score queries */
export const scoresOrderBySchema = z
  .object({
    field: scoresOrderByFieldSchema.default('timestamp').describe('Field to order by'),
    direction: sortDirectionSchema.default('DESC').describe('Sort direction'),
  })
  .describe('Order by configuration');

/** Schema for listScores operation arguments */
export const listScoresArgsSchema = z
  .object({
    filters: scoresFilterSchema.optional().describe('Optional filters to apply'),
    pagination: paginationArgsSchema.default({}).describe('Pagination settings'),
    orderBy: scoresOrderBySchema.default({}).describe('Ordering configuration (defaults to timestamp desc)'),
  })
  .describe('Arguments for listing scores');

/** Arguments for listing scores */
export type ListScoresArgs = z.input<typeof listScoresArgsSchema>;

/** Schema for listScores operation response */
export const listScoresResponseSchema = z.object({
  pagination: paginationInfoSchema,
  scores: z.array(scoreRecordSchema),
});

/** Response containing paginated scores */
export type ListScoresResponse = z.infer<typeof listScoresResponseSchema>;
```

**TODO:** Verify alignment with existing evals scores schema.

**Tasks:**
- [ ] Define `scoreRecordSchema` (storage format)
- [ ] Define `scoreInputSchema` (user API)
- [ ] Define `createScoreRecordSchema` (excludes db timestamps)
- [ ] Define `createScoreArgsSchema`
- [ ] Define `scoresFilterSchema` with all filter options
- [ ] Define `scoresOrderBySchema`
- [ ] Define `listScoresArgsSchema`
- [ ] Define `listScoresResponseSchema`

---

## 6.0.4 Feedback Record & Storage Schemas

**File:** `packages/core/src/storage/domains/observability/feedback.ts` (new)

```typescript
import { z } from 'zod';
import { dateRangeSchema, paginationArgsSchema, paginationInfoSchema, sortDirectionSchema, dbTimestamps } from '../shared';

// ============================================================================
// Field Schemas (Zod versions for storage/API validation)
// ============================================================================

/** Feedback source field */
const feedbackSourceField = z.string().describe("Source of feedback (e.g., 'user', 'system', 'manual')");

/** Feedback type field */
const feedbackTypeField = z.string().describe("Type of feedback (e.g., 'thumbs', 'rating', 'correction')");

/** Feedback value field (can be number or string) */
const feedbackValueField = z.union([z.number(), z.string()]).describe('Feedback value (rating number or correction text)');

/** Feedback comment field */
const feedbackCommentField = z.string().describe('Additional comment or context');

/** Feedback experiment field */
const feedbackExperimentField = z.string().describe('Experiment or eval run identifier');

// ============================================================================
// FeedbackRecord Schema (Storage Format)
// ============================================================================

/**
 * Schema for feedback as stored in the database.
 * Includes all fields from ExportedFeedback plus storage-specific fields.
 */
export const feedbackRecordSchema = z
  .object({
    id: z.string().describe('Unique feedback record identifier'),
    timestamp: z.date().describe('When the feedback was recorded'),

    // Target
    traceId: z.string().describe('Trace ID this feedback applies to'),
    spanId: z.string().nullish().describe('Span ID this feedback applies to'),

    // Feedback data
    source: feedbackSourceField,
    feedbackType: feedbackTypeField,
    value: feedbackValueField,
    comment: feedbackCommentField.nullish(),
    experiment: feedbackExperimentField.nullish(),

    // User-defined metadata (context fields stored here)
    metadata: z.record(z.unknown()).nullish().describe('User-defined metadata'),

    // Database timestamps
    ...dbTimestamps,
  })
  .describe('Feedback record as stored in the database');

/** Feedback record type for storage */
export type FeedbackRecord = z.infer<typeof feedbackRecordSchema>;

// ============================================================================
// FeedbackInput Schema (User-Facing API)
// ============================================================================

/**
 * Schema for user-provided feedback input (minimal required fields).
 * The span/trace context adds traceId/spanId before emitting ExportedFeedback.
 */
export const feedbackInputSchema = z
  .object({
    source: feedbackSourceField,
    feedbackType: feedbackTypeField,
    value: feedbackValueField,
    comment: feedbackCommentField.optional(),
    userId: z.string().optional().describe('User ID who provided the feedback'),
    metadata: z.record(z.unknown()).optional().describe('Additional feedback-specific metadata'),
    experiment: feedbackExperimentField.optional(),
  })
  .describe('User-provided feedback input');

/** User-facing feedback input type */
export type FeedbackInput = z.infer<typeof feedbackInputSchema>;

// ============================================================================
// Create Feedback Schemas
// ============================================================================

/** Schema for creating a feedback record (without db timestamps) */
export const createFeedbackRecordSchema = feedbackRecordSchema.omit({
  createdAt: true,
  updatedAt: true,
});

/** Feedback record for creation (excludes db timestamps) */
export type CreateFeedbackRecord = z.infer<typeof createFeedbackRecordSchema>;

/** Schema for createFeedback operation arguments */
export const createFeedbackArgsSchema = z
  .object({
    feedback: createFeedbackRecordSchema,
  })
  .describe('Arguments for creating feedback');

/** Arguments for creating feedback */
export type CreateFeedbackArgs = z.infer<typeof createFeedbackArgsSchema>;

// ============================================================================
// Feedback Filter Schema
// ============================================================================

/** Schema for filtering feedback in list queries */
export const feedbackFilterSchema = z
  .object({
    // Date range
    timestamp: dateRangeSchema.optional().describe('Filter by feedback timestamp range'),

    // Target filters
    traceId: z.string().optional().describe('Filter by trace ID'),
    spanId: z.string().optional().describe('Filter by span ID'),

    // Feedback filters
    feedbackType: z.union([z.string(), z.array(z.string())]).optional().describe('Filter by feedback type(s)'),
    source: z.string().optional().describe('Filter by feedback source (e.g., user, system, manual)'),
    experiment: z.string().optional().describe('Filter by experiment or eval run identifier'),

    // Attribution
    userId: z.string().optional().describe('Filter by user ID who provided the feedback'),

    // Multi-tenancy filters
    organizationId: z.string().optional().describe('Filter by organization ID'),

    // Environment filters
    serviceName: z.string().optional().describe('Filter by service name'),
    environment: z.string().optional().describe('Filter by environment (e.g., production, staging)'),
  })
  .describe('Filters for querying feedback');

/** Filters for querying feedback */
export type FeedbackFilter = z.infer<typeof feedbackFilterSchema>;

// ============================================================================
// List Feedback Schemas
// ============================================================================

/** Fields available for ordering feedback results */
export const feedbackOrderByFieldSchema = z
  .enum(['timestamp'])
  .describe("Field to order by: 'timestamp'");

/** Order by configuration for feedback queries */
export const feedbackOrderBySchema = z
  .object({
    field: feedbackOrderByFieldSchema.default('timestamp').describe('Field to order by'),
    direction: sortDirectionSchema.default('DESC').describe('Sort direction'),
  })
  .describe('Order by configuration');

/** Schema for listFeedback operation arguments */
export const listFeedbackArgsSchema = z
  .object({
    filters: feedbackFilterSchema.optional().describe('Optional filters to apply'),
    pagination: paginationArgsSchema.default({}).describe('Pagination settings'),
    orderBy: feedbackOrderBySchema.default({}).describe('Ordering configuration (defaults to timestamp desc)'),
  })
  .describe('Arguments for listing feedback');

/** Arguments for listing feedback */
export type ListFeedbackArgs = z.input<typeof listFeedbackArgsSchema>;

/** Schema for listFeedback operation response */
export const listFeedbackResponseSchema = z.object({
  pagination: paginationInfoSchema,
  feedback: z.array(feedbackRecordSchema),
});

/** Response containing paginated feedback */
export type ListFeedbackResponse = z.infer<typeof listFeedbackResponseSchema>;
```

**TODO:** Revisit table name `mastra_ai_trace_feedback`.

**Tasks:**
- [ ] Define `feedbackRecordSchema` (storage format)
- [ ] Define `feedbackInputSchema` (user API)
- [ ] Define `createFeedbackRecordSchema` (excludes db timestamps)
- [ ] Define `createFeedbackArgsSchema`
- [ ] Define `feedbackFilterSchema` with all filter options
- [ ] Define `feedbackOrderBySchema`
- [ ] Define `listFeedbackArgsSchema`
- [ ] Define `listFeedbackResponseSchema`

---

## 6.0.5 Storage Interface Extensions

**File:** `packages/core/src/storage/domains/observability/base.ts` (modify)

```typescript
import {
  BatchCreateLogsArgs,
  ListLogsArgs,
  ListLogsResponse,
} from './logs';
import {
  BatchRecordMetricsArgs,
  ListMetricsArgs,
  ListMetricsResponse,
} from './metrics';
import {
  CreateScoreArgs,
  ListScoresArgs,
  ListScoresResponse,
} from './scores';
import {
  CreateFeedbackArgs,
  ListFeedbackArgs,
  ListFeedbackResponse,
} from './feedback';

// Add to ObservabilityStorage abstract class

// === Logs ===
async batchCreateLogs(args: BatchCreateLogsArgs): Promise<void> {
  throw new Error('Not implemented');
}

async listLogs(args: ListLogsArgs): Promise<ListLogsResponse> {
  throw new Error('Not implemented');
}

// === Metrics ===
async batchRecordMetrics(args: BatchRecordMetricsArgs): Promise<void> {
  throw new Error('Not implemented');
}

async listMetrics(args: ListMetricsArgs): Promise<ListMetricsResponse> {
  throw new Error('Not implemented');
}

// === Scores ===
async createScore(args: CreateScoreArgs): Promise<void> {
  throw new Error('Not implemented');
}

async listScores(args: ListScoresArgs): Promise<ListScoresResponse> {
  throw new Error('Not implemented');
}

// === Feedback ===
async createFeedback(args: CreateFeedbackArgs): Promise<void> {
  throw new Error('Not implemented');
}

async listFeedback(args: ListFeedbackArgs): Promise<ListFeedbackResponse> {
  throw new Error('Not implemented');
}
```

**Tasks:**
- [ ] Import all operation types
- [ ] Add logs methods (`batchCreateLogs`, `listLogs`)
- [ ] Add metrics methods (`batchRecordMetrics`, `listMetrics`)
- [ ] Add scores methods (`createScore`, `listScores`)
- [ ] Add feedback methods (`createFeedback`, `listFeedback`)

---

## 6.0.6 Storage Strategy Types

**File:** `packages/core/src/storage/domains/observability/types.ts` (modify)

```typescript
// Storage strategy types for each signal
export type LogsStorageStrategy = 'realtime' | 'batch';
export type MetricsStorageStrategy = 'realtime' | 'batch';
export type ScoresStorageStrategy = 'realtime';
export type FeedbackStorageStrategy = 'realtime';
```

The strategy getters are already defined in Phase 1 (return `null` by default). Subclasses override to declare support.

**Tasks:**
- [ ] Verify LogsStorageStrategy type exists
- [ ] Verify MetricsStorageStrategy type exists
- [ ] Verify ScoresStorageStrategy type exists
- [ ] Verify FeedbackStorageStrategy type exists

---

## PR 6.0 Testing

**Tasks:**
- [ ] Test all Input schemas validation
- [ ] Test all Record schemas validation
- [ ] Test all filter schemas accept valid filters
- [ ] Test all filter schemas reject invalid data
- [ ] Test create schemas properly omit db timestamps
- [ ] Test list args schemas have proper defaults
- [ ] Test response schemas match expected structure
- [ ] Verify all type exports work correctly
