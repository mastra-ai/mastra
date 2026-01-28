import { z } from 'zod';
import { scoreRowDataSchema } from '../../../evals/types';
import { SpanType } from '../../../observability/types';
import {
  dateRangeSchema,
  dbTimestamps,
  entityIdField,
  entityNameField,
  entityTypeField,
  environmentField,
  organizationIdField,
  paginationArgsSchema,
  paginationInfoSchema,
  requestIdField,
  resourceIdField,
  runIdField,
  serviceNameField,
  sessionIdField,
  sortDirectionSchema,
  sourceField,
  threadIdField,
  userIdField,
} from '../shared';

/** Strategy for how tracing data is persisted to storage */
export type TracingStorageStrategy = 'realtime' | 'batch-with-updates' | 'insert-only';

// ============================================================================
// Helper utilities for creating omit key objects from schema shapes
// ============================================================================

/**
 * Creates an omit key object from a Zod schema shape.
 * This allows dynamically deriving omit keys from existing schema definitions.
 */
const createOmitKeys = <T extends z.ZodRawShape>(shape: T): { [K in keyof T]: true } =>
  Object.fromEntries(Object.keys(shape).map(k => [k, true])) as { [K in keyof T]: true };

// ============================================================================
// Primitive Field Definitions
// ============================================================================

/** Zod schema for trace ID field */
export const traceIdField = z.string().describe('Unique trace identifier');

/** Zod schema for span ID field */
export const spanIdField = z.string().describe('Unique span identifier within a trace');

const spanNameField = z.string().describe('Human-readable span name');
const parentSpanIdField = z.string().describe('Parent span reference (null = root span)');
const spanTypeField = z.nativeEnum(SpanType).describe('Span type (e.g., WORKFLOW_RUN, AGENT_RUN, TOOL_CALL, etc.)');
const attributesField = z.record(z.unknown()).describe('Span-type specific attributes (e.g., model, tokens, tools)');
const metadataField = z.record(z.unknown()).describe('User-defined metadata for custom filtering');
const tagsField = z.array(z.string()).describe('Labels for filtering traces (only on the root span)');
const scopeField = z
  .record(z.unknown())
  .describe('Arbitrary package/app version info (e.g., {"core": "1.0.0", "memory": "1.0.0", "gitSha": "abcd1234"})');
const linksField = z.array(z.unknown()).describe('References to related spans in other traces');
const inputField = z.unknown().describe('Input data passed to the span');
const outputField = z.unknown().describe('Output data returned from the span');
const errorField = z.unknown().describe('Error info - presence indicates failure (status derived from this)');
const isEventField = z.boolean().describe('Whether this is an event (point-in-time) vs a span (duration)');
const startedAtField = z.date().describe('When the span started');
const endedAtField = z.date().describe('When the span ended (null = running, status derived from this)');

/** Status of a trace derived from the root span's state */
export enum TraceStatus {
  SUCCESS = 'success',
  ERROR = 'error',
  RUNNING = 'running',
}

const traceStatusField = z.nativeEnum(TraceStatus).describe('Current status of the trace');

const hasChildErrorField = z
  .preprocess(v => {
    // Handle string "true"/"false" from query params correctly
    // z.coerce.boolean() would convert "false" to true (Boolean("false") === true)
    if (v === 'true') return true;
    if (v === 'false') return false;
    return v;
  }, z.boolean())
  .describe('True if any span in the trace encountered an error');

// ============================================================================
// Shared Fields (used by both spanRecordSchema and tracesFilterSchema)
// ============================================================================

/**
 * All optional fields shared between span records and trace filters.
 * Note: When filtering traces, these fields are matched against the root span.
 */
const sharedFields = {
  // Entity identification - first-class fields for filtering (e.g., agent, workflow, tool)
  entityType: entityTypeField.nullish(),
  entityId: entityIdField.nullish(),
  entityName: entityNameField.nullish(),

  // Identity & tenancy - for multi-tenant applications
  userId: userIdField.nullish(),
  organizationId: organizationIdField.nullish(),
  resourceId: resourceIdField.nullish(),

  // Correlation IDs - for linking related operations
  runId: runIdField.nullish(),
  sessionId: sessionIdField.nullish(),
  threadId: threadIdField.nullish(),
  requestId: requestIdField.nullish(),

  // Deployment context - these fields only exist on the root span
  environment: environmentField.nullish(),
  source: sourceField.nullish(),
  serviceName: serviceNameField.nullish(),
  scope: scopeField.nullish(),

  // Filterable data - user-defined metadata and tags (tags only on root span)
  metadata: metadataField.nullish(),
  tags: tagsField.nullish(),
} as const;

// ============================================================================
// Span Record Schema (for storage)
// ============================================================================

/** Shape containing trace and span identifier fields */
export const spanIds = {
  traceId: traceIdField,
  spanId: spanIdField,
} as const satisfies z.ZodRawShape;

/** Schema for span identifiers (traceId and spanId) */
export const spanIdsSchema = z.object({
  ...spanIds,
});

/** Span identifier pair (traceId and spanId) */
export type SpanIds = z.infer<typeof spanIdsSchema>;

// Omit key objects derived from schema shapes for use with .omit()
const omitDbTimestamps = createOmitKeys(dbTimestamps);
const omitSpanIds = createOmitKeys(spanIds);

/** Schema for a complete span record as stored in the database */
export const spanRecordSchema = z
  .object({
    // Required identifiers
    ...spanIds,
    name: spanNameField,
    spanType: spanTypeField,
    isEvent: isEventField,
    startedAt: startedAtField,

    // Shared fields
    parentSpanId: parentSpanIdField.nullish(),
    ...sharedFields,

    // Additional span-specific nullish fields
    attributes: attributesField.nullish(),
    links: linksField.nullish(),
    input: inputField.nullish(),
    output: outputField.nullish(),
    error: errorField.nullish(),
    endedAt: endedAtField.nullish(),

    // Database timestamps
    ...dbTimestamps,
  })
  .describe('Span record data');

/** Complete span record as stored in the database */
export type SpanRecord = z.infer<typeof spanRecordSchema>;

// ============================================================================
// Trace Span Schema (SpanRecord + computed status for list responses)
// ============================================================================

/**
 * Computes the trace status from a root span's error and endedAt fields.
 * - ERROR: if error is present (regardless of endedAt)
 * - RUNNING: if endedAt is null/undefined and no error
 * - SUCCESS: if endedAt is present and no error
 */
export function computeTraceStatus(span: SpanRecord): TraceStatus {
  if (span.error != null) return TraceStatus.ERROR;
  if (span.endedAt == null) return TraceStatus.RUNNING;
  return TraceStatus.SUCCESS;
}

/** Schema for a trace span (root span with computed status) */
export const traceSpanSchema = spanRecordSchema
  .extend({
    status: traceStatusField,
  })
  .describe('Trace span with computed status (root spans only)');

/** Trace span (root span with computed status) */
export type TraceSpan = z.infer<typeof traceSpanSchema>;

/**
 * Converts a SpanRecord to a TraceSpan by adding computed status.
 * Used when returning root spans from listTraces.
 */
export function toTraceSpan(span: SpanRecord): TraceSpan {
  return {
    ...span,
    status: computeTraceStatus(span),
  };
}

/**
 * Converts an array of SpanRecords to TraceSpans by adding computed status.
 * Used when returning root spans from listTraces.
 */
export function toTraceSpans(spans: SpanRecord[]): TraceSpan[] {
  return spans.map(toTraceSpan);
}

// ============================================================================
// Storage Operation Schemas
// ============================================================================

/**
 * Schema for creating a span (without db timestamps)
 */
export const createSpanRecordSchema = spanRecordSchema.omit(omitDbTimestamps);

/** Span record for creation (excludes db timestamps) */
export type CreateSpanRecord = z.infer<typeof createSpanRecordSchema>;

/**
 * Schema for createSpan operation arguments
 */
export const createSpanArgsSchema = z
  .object({
    span: createSpanRecordSchema,
  })
  .describe('Arguments for creating a single span');

/** Arguments for creating a single span */
export type CreateSpanArgs = z.infer<typeof createSpanArgsSchema>;

/**
 * Schema for batchCreateSpans operation arguments
 */
export const batchCreateSpansArgsSchema = z
  .object({
    records: z.array(createSpanRecordSchema),
  })
  .describe('Arguments for batch creating spans');

/** Arguments for batch creating multiple spans */
export type BatchCreateSpansArgs = z.infer<typeof batchCreateSpansArgsSchema>;

/**
 * Schema for getSpan operation arguments
 */
export const getSpanArgsSchema = z
  .object({
    traceId: traceIdField.min(1),
    spanId: spanIdField.min(1),
  })
  .describe('Arguments for getting a single span');

/** Arguments for retrieving a single span */
export type GetSpanArgs = z.infer<typeof getSpanArgsSchema>;

/**
 * Response schema for getSpan operation
 */
export const getSpanResponseSchema = z.object({
  span: spanRecordSchema,
});

/** Response containing a single span */
export type GetSpanResponse = z.infer<typeof getSpanResponseSchema>;

/**
 * Schema for getRootSpan operation arguments
 */
export const getRootSpanArgsSchema = z
  .object({
    traceId: traceIdField.min(1),
  })
  .describe('Arguments for getting a root span');

/** Arguments for retrieving a root span */
export type GetRootSpanArgs = z.infer<typeof getRootSpanArgsSchema>;

/**
 * Response schema for getRootSpan operation
 */
export const getRootSpanResponseSchema = z.object({
  span: spanRecordSchema,
});

/** Response containing a single root span */
export type GetRootSpanResponse = z.infer<typeof getRootSpanResponseSchema>;

/**
 * Schema for getTrace operation arguments
 */
export const getTraceArgsSchema = z
  .object({
    traceId: traceIdField.min(1),
  })
  .describe('Arguments for getting a single trace');

/** Arguments for retrieving a single trace */
export type GetTraceArgs = z.infer<typeof getTraceArgsSchema>;

/**
 * Response schema for getTrace operation
 */
export const getTraceResponseSchema = z.object({
  traceId: traceIdField,
  spans: z.array(spanRecordSchema),
});

/** Response containing a trace with all its spans */
export type GetTraceResponse = z.infer<typeof getTraceResponseSchema>;

export type TraceRecord = GetTraceResponse;

/** Schema for filtering traces in list queries */
export const tracesFilterSchema = z
  .object({
    // Date range filters
    startedAt: dateRangeSchema.optional().describe('Filter by span start time range'),
    endedAt: dateRangeSchema.optional().describe('Filter by span end time range'),

    // Span type filter
    spanType: spanTypeField.optional(),

    // Shared fields
    ...sharedFields,

    // Filter-specific derived status fields
    status: traceStatusField.optional(),
    hasChildError: hasChildErrorField.optional(),
  })
  .describe('Filters for querying traces');

/**
 * Fields available for ordering trace results
 */
export const tracesOrderByFieldSchema = z
  .enum(['startedAt', 'endedAt'])
  .describe("Field to order by: 'startedAt' | 'endedAt'");

/**
 * Order by configuration for trace queries
 * Follows the existing StorageOrderBy pattern
 * Defaults to startedAt desc (newest first)
 */
export const tracesOrderBySchema = z
  .object({
    field: tracesOrderByFieldSchema.default('startedAt').describe('Field to order by'),
    direction: sortDirectionSchema.default('DESC').describe('Sort direction'),
  })
  .describe('Order by configuration');

/**
 * Arguments for listing traces
 */
export const listTracesArgsSchema = z
  .object({
    filters: tracesFilterSchema.optional().describe('Optional filters to apply'),
    pagination: paginationArgsSchema.default({}).describe('Pagination settings'),
    orderBy: tracesOrderBySchema.default({}).describe('Ordering configuration (defaults to startedAt desc)'),
  })
  .describe('Arguments for listing traces');

/** Arguments for listing traces with optional filters, pagination, and ordering */
export type ListTracesArgs = z.input<typeof listTracesArgsSchema>;

/** Schema for listTraces operation response */
export const listTracesResponseSchema = z.object({
  pagination: paginationInfoSchema,
  spans: z.array(traceSpanSchema),
});

/** Response containing paginated root spans with computed status */
export type ListTracesResponse = z.infer<typeof listTracesResponseSchema>;

/**
 * Schema for updating a span (without db timestamps and span IDs)
 */
export const updateSpanRecordSchema = createSpanRecordSchema.omit(omitSpanIds);

/** Partial span data for updates (excludes db timestamps and span IDs) */
export type UpdateSpanRecord = z.infer<typeof updateSpanRecordSchema>;

/**
 * Schema for updateSpan operation arguments
 */
export const updateSpanArgsSchema = z
  .object({
    spanId: spanIdField,
    traceId: traceIdField,
    updates: updateSpanRecordSchema.partial(),
  })
  .describe('Arguments for updating a single span');

/** Arguments for updating a single span */
export type UpdateSpanArgs = z.infer<typeof updateSpanArgsSchema>;

/**
 * Schema for batchUpdateSpans operation arguments
 */
export const batchUpdateSpansArgsSchema = z
  .object({
    records: z.array(
      z.object({
        traceId: traceIdField,
        spanId: spanIdField,
        updates: updateSpanRecordSchema.partial(),
      }),
    ),
  })
  .describe('Arguments for batch updating spans');

/** Arguments for batch updating multiple spans */
export type BatchUpdateSpansArgs = z.infer<typeof batchUpdateSpansArgsSchema>;

/**
 * Schema for batchDeleteTraces operation arguments
 */
export const batchDeleteTracesArgsSchema = z
  .object({
    traceIds: z.array(traceIdField),
  })
  .describe('Arguments for batch deleting traces');

/** Arguments for batch deleting multiple traces */
export type BatchDeleteTracesArgs = z.infer<typeof batchDeleteTracesArgsSchema>;

// ============================================================================
// Scoring related schemas
// ============================================================================

/** Schema for listScoresBySpan operation response */
export const listScoresBySpanResponseSchema = z.object({
  pagination: paginationInfoSchema,
  scores: z.array(scoreRowDataSchema),
});

/** Schema for scoreTraces operation request */
export const scoreTracesRequestSchema = z.object({
  scorerName: z.string().min(1),
  targets: z
    .array(
      z.object({
        traceId: traceIdField,
        spanId: spanIdField.optional(),
      }),
    )
    .min(1),
});

/** Request to score traces using a specific scorer */
export type ScoreTracesRequest = z.infer<typeof scoreTracesRequestSchema>;

/** Schema for scoreTraces operation response */
export const scoreTracesResponseSchema = z.object({
  status: z.string(),
  message: z.string(),
  traceCount: z.number(),
});

/** Response from scoring traces */
export type ScoreTracesResponse = z.infer<typeof scoreTracesResponseSchema>;
