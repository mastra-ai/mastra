import z from 'zod';
import { SpanType } from '../../../observability/types';
import {
  dateRangeSchema,
  dbTimestamps,
  entityIdField,
  entityNameField,
  entityTypeField,
  environmentField,
  jsonValueSchema,
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

export const traceIdField = z.string().describe('Unique trace identifier');
export const spanIdField = z.string().describe('Unique span identifier within a trace');

const spanNameField = z.string().describe('Human-readable span name');

const parentSpanIdField = z.string().describe('Parent span reference (null = root span)');

const spanTypeField = z.nativeEnum(SpanType).describe('Span type (e.g., WORKFLOW_RUN, AGENT_RUN, TOOL_CALL, etc.)');

const attributesField = z
  .record(jsonValueSchema)
  .describe('Span-type specific attributes (e.g., model, tokens, tools)');

const metadataField = z.record(jsonValueSchema).describe('User-defined metadata for custom filtering');

const tagsField = z.array(z.string()).describe('Labels for filtering traces (only on the root span)');

const scopeField = z
  .record(jsonValueSchema)
  .describe('Arbitrary package/app version info (e.g., {"core": "1.0.0", "memory": "1.0.0", "gitSha": "abcd1234"})');

const linksField = z.array(jsonValueSchema).describe('References to related spans in other traces');

const inputField = jsonValueSchema.describe('Input data passed to the span');

const outputField = jsonValueSchema.describe('Output data returned from the span');

const errorField = jsonValueSchema.describe('Error info - presence indicates failure (status derived from this)');

const isEventField = z.boolean().describe('Whether this is an event (point-in-time) vs a span (duration)');

const startedAtField = z.date().describe('When the span started');

const endedAtField = z.date().describe('When the span ended (null = running, status derived from this)');

export const spanIds = {
  traceId: traceIdField,
  spanId: spanIdField,
} as const satisfies z.ZodRawShape;

export const spanIdsSchema = z.object({
  ...spanIds,
});

export type SpanIds = z.infer<typeof spanIdsSchema>;

export const spanRecordSchema = z
  .object({
    ...spanIds,
    parentSpanId: parentSpanIdField.nullable(),
    name: spanNameField,

    // Entity identification - first-class fields for filtering
    entityType: entityTypeField.nullable(),
    entityId: entityIdField.nullable(),
    entityName: entityNameField.nullable(),

    // Identity & Tenancy
    userId: userIdField.nullable(),
    organizationId: organizationIdField.nullable(),
    resourceId: resourceIdField.nullable(),

    // Correlation IDs
    runId: runIdField.nullable(),
    sessionId: sessionIdField.nullable(),
    threadId: threadIdField.nullable(),
    requestId: requestIdField.nullable(),

    // Deployment context (these items only exist on the root span)
    environment: environmentField.nullable(),
    source: sourceField.nullable(),
    serviceName: serviceNameField.nullable(),
    scope: scopeField.nullable(),

    // Span data
    spanType: spanTypeField,
    attributes: attributesField.nullable(),
    metadata: metadataField.nullable(),
    tags: tagsField.nullable(),
    links: linksField.nullable(),
    input: inputField.nullable(),
    output: outputField.nullable(),
    error: errorField.nullable(),
    isEvent: isEventField,

    // Timestamps
    startedAt: startedAtField,
    endedAt: endedAtField.nullable(),
    ...dbTimestamps,
  })
  .describe('Span record data');

export const traceRecordSchema = z.object({
  traceId: traceIdField,
  spans: z.array(spanRecordSchema),
});

export enum TraceStatus {
  SUCCESS = 'success',
  ERROR = 'error',
  RUNNING = 'running',
}

const traceStatusField = z.nativeEnum(TraceStatus).describe('Current status of the trace');

const hasChildErrorField = z.coerce.boolean().describe('True if any span in the trace encountered an error');

/**
 * Filters for querying traces (with proper types)
 */
export const tracesFilterSchema = z
  .object({
    // Date range filters for startedAt and endedAt
    startedAt: dateRangeSchema.optional().describe('Filter by span start time range'),
    endedAt: dateRangeSchema.optional().describe('Filter by span end time range'),

    // Span type filter
    spanType: spanTypeField.optional(),

    // Entity filters
    entityType: entityTypeField.optional(),
    entityId: entityIdField.optional(),
    entityName: entityNameField.optional(),

    // Identity & Tenancy filters
    userId: userIdField.optional(),
    organizationId: organizationIdField.optional(),
    resourceId: resourceIdField.optional(),

    // Correlation ID filters
    runId: runIdField.optional(),
    sessionId: sessionIdField.optional(),
    threadId: threadIdField.optional(),
    requestId: requestIdField.optional(),

    // Deployment context filters
    environment: environmentField.optional(),
    source: sourceField.optional(),
    serviceName: serviceNameField.optional(),
    scope: scopeField.optional(),

    // Span data filters
    metadata: metadataField.optional(),
    tags: tagsField.optional(),

    // Derived status filters
    status: traceStatusField.optional(),
    hasChildError: hasChildErrorField.optional(),
  })
  .describe('Filters for querying traces');

/**
 * Fields available for ordering trace results
 */
const tracesOrderByFieldSchema = z
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
export const listTracesSchema = z
  .object({
    filters: tracesFilterSchema.optional().describe('Optional filters to apply'),
    pagination: paginationArgsSchema.optional().describe('Optional pagination settings'),
    orderBy: tracesOrderBySchema.optional().default({}).describe('Ordering configuration (defaults to startedAt desc)'),
  })
  .describe('Arguments for listing traces');

export const listTracesResponseSchema = z.object({
  pagination: paginationInfoSchema,
  spans: z.array(spanRecordSchema),
});

export const listScoresBySpanResponseSchema = z.object({
  pagination: paginationInfoSchema,
  scores: z.array(z.unknown()),
});

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

export type ScoreTracesRequest = z.infer<typeof scoreTracesRequestSchema>;

export const scoreTracesResponseSchema = z.object({
  status: z.string(),
  message: z.string(),
  traceCount: z.number(),
});

export type ScoreTracesResponse = z.infer<typeof scoreTracesResponseSchema>;
