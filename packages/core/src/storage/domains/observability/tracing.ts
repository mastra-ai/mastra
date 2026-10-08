import { z } from 'zod/v4';
import { scoreRowDataSchema } from '../../../evals/types';
import { describeSpanInput, describeSpanOutput } from '../../../observability/span-record';
import { SpanType } from '../../../observability/types';
import type { SpanInput, SpanOutput, SpanTypeMap } from '../../../observability/types';
import {
  deltaLimitSchema,
  deltaInfoSchema,
  spanContextFields,
  dateRangeSchema,
  dbTimestamps,
  deltaCursorSchema,
  listModeSchema,
  metadataField,
  normalizeObservabilityListArgs,
  paginationArgsSchema,
  paginationInfoSchema,
  refineObservabilityListMode,
  sortDirectionSchema,
  organizationIdField,
  resourceIdField,
  tagsField,
  traceIdField,
  spanIdField,
} from '../shared';

export { traceIdField, spanIdField };

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

const spanNameField = z.string().describe('Human-readable span name');
const parentSpanIdField = z.string().describe('Parent span reference (null = root span)');
const spanTypeField = z.nativeEnum(SpanType).describe('Span type (e.g., WORKFLOW_RUN, AGENT_RUN, TOOL_CALL, etc.)');
const attributesField = z
  .record(z.string(), z.unknown())
  .describe('Span-type specific attributes (e.g., model, tokens, tools)');
const linksField = z.array(z.unknown()).describe('References to related spans in other traces');
const inputField = z.unknown().describe('Input data passed to the span');
const outputField = z.unknown().describe('Output data returned from the span');
const errorField = z.unknown().describe('Error info - presence indicates failure (status derived from this)');
const isEventField = z.boolean().describe('Whether this is an event (point-in-time) vs a span (duration)');
const startedAtField = z.date().describe('When the span started');
const endedAtField = z.date().describe('When the span ended (null = running, status derived from this)');

/** Derived status of a trace, computed from the root span's error and endedAt fields. */
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
 * Built from spanContextFields plus span-specific metadata/tags.
 * Note: When filtering traces, these fields are matched against the root span.
 */
const sharedFields = {
  ...spanContextFields,
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

    // Experimentation
    experimentId: z.string().nullish().describe('Experiment or eval run identifier'),

    // Additional span-specific nullish fields
    attributes: attributesField.nullish(),
    links: linksField.nullish(),
    input: inputField.nullish(),
    output: outputField.nullish(),
    error: errorField.nullish(),
    endedAt: endedAtField.nullish(),
    requestContext: z.record(z.string(), z.unknown()).nullish().describe('Request context data'),

    // Database timestamps
    ...dbTimestamps,
  })
  .describe('Span record data');

/** Span record exactly as the schema stores it: payload fields are untyped. */
type StoredSpanRecord = z.infer<typeof spanRecordSchema>;

/**
 * Stored span record narrowed to one span type: `attributes`, `input` and
 * `output` carry the shapes core records for that type. A union of span types
 * gives a union of records, so `spanType` keeps discriminating after the
 * guard.
 */
export type TypedSpanRecord<TType extends SpanType> = TType extends SpanType
  ? Omit<StoredSpanRecord, 'spanType' | 'attributes' | 'input' | 'output'> & {
      spanType: TType;
      attributes?: (SpanTypeMap[TType] & Record<string, unknown>) | null;
      input?: SpanInput<TType> | null;
      output?: SpanOutput<TType> | null;
    }
  : never;

/**
 * Complete span record as stored in the database.
 *
 * Without a type argument this is the stored record as-is. Narrow `TType` to
 * get a `TypedSpanRecord`. The schema itself stays permissive, so this is a
 * read-side view only; narrow with `isSpanRecordOfType` from
 * `@mastra/core/observability`.
 */
export type SpanRecord<TType extends SpanType = SpanType> = SpanType extends TType
  ? StoredSpanRecord
  : TypedSpanRecord<TType>;

// ============================================================================
// Trace Span Schema (SpanRecord + computed status for list responses)
// ============================================================================

/**
 * Computes the trace status from a root span's error and endedAt fields.
 * - ERROR: if error is present (regardless of endedAt)
 * - RUNNING: if endedAt is null/undefined and no error
 * - SUCCESS: if endedAt is present and no error
 */
export function computeTraceStatus(span: { error?: unknown; endedAt?: Date | string | null }): TraceStatus {
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
 * Schema for getSpans (batch) operation arguments.
 *
 * Fetches multiple spans in a trace by spanId in one call. Used to power the
 * progressive-disclosure path in {@link getBranchArgsSchema}: walk the
 * lightweight {@link getStructureResponseSchema} to find which spanIds belong
 * to a branch, then fetch only those with full data instead of pulling the
 * entire trace.
 */
export const getSpansArgsSchema = z
  .object({
    traceId: traceIdField.min(1),
    spanIds: z.array(spanIdField.min(1)).min(1).describe('Span IDs to fetch within the trace'),
  })
  .describe('Arguments for batch-fetching spans by spanId within a trace');

/** Arguments for batch-fetching spans by spanId */
export type GetSpansArgs = z.infer<typeof getSpansArgsSchema>;

/** Response schema for getSpans operation */
export const getSpansResponseSchema = z.object({
  traceId: traceIdField,
  spans: z.array(spanRecordSchema),
});

/** Response containing the requested spans (order is not guaranteed) */
export type GetSpansResponse = z.infer<typeof getSpansResponseSchema>;

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

/** Alias for GetTraceResponse -- a trace with all its spans. */
export type TraceRecord = GetTraceResponse;

/**
 * Schema for getBranch operation arguments.
 *
 * Returns the subtree rooted at `spanId`. When `depth` is omitted the full
 * descendant subtree is returned; with a finite `depth` only that many levels
 * below the anchor are returned (depth: 0 → only the anchor span; depth: 1 →
 * anchor plus immediate children; etc).
 */
export const getBranchArgsSchema = z
  .object({
    traceId: traceIdField.min(1),
    spanId: spanIdField.min(1),
    depth: z.coerce
      .number()
      .int()
      .min(0)
      .optional()
      .describe('Maximum descendant levels below the anchor span (omit for full subtree)'),
  })
  .describe('Arguments for getting a span branch (subtree rooted at a span)');

/** Arguments for retrieving the subtree rooted at a span */
export type GetBranchArgs = z.input<typeof getBranchArgsSchema>;

/**
 * Response schema for getBranch operation. Mirrors getTrace -- a flat list of
 * spans, traversal-agnostic. The anchor span is included as the first matching
 * span; callers reconstruct the tree via parentSpanId.
 */
export const getBranchResponseSchema = z.object({
  traceId: traceIdField,
  spans: z.array(spanRecordSchema),
});

/** Response containing the subtree rooted at a span */
export type GetBranchResponse = z.infer<typeof getBranchResponseSchema>;

/**
 * Extracts the subtree rooted at `anchorSpanId` from a flat list of trace
 * spans. The anchor itself is included as the first element; descendants are
 * walked via `parentSpanId` and returned sorted by `startedAt` ascending after
 * the anchor. When `maxDepth` is provided, only that many levels of
 * descendants are returned (anchor counts as depth 0).
 *
 * Cycles in `parentSpanId` (which shouldn't happen in well-formed traces but
 * could surface from corrupted data) are handled by tracking visited spanIds
 * and skipping any span seen during this walk.
 *
 * Returns an empty array if the anchor isn't in the input.
 *
 * Generic over the span shape so it works on both full {@link SpanRecord}
 * lists (e.g. result of `getTrace`) and lightweight skeletons (result of
 * `getStructure`).
 */
export function extractBranchSpans<
  T extends { spanId: string; parentSpanId?: string | null | undefined; startedAt: Date },
>(spans: T[], anchorSpanId: string, maxDepth?: number): T[] {
  const anchor = spans.find(s => s.spanId === anchorSpanId);
  if (!anchor) return [];

  // Build parentSpanId → children index for O(1) descent.
  const childrenByParent = new Map<string, T[]>();
  for (const span of spans) {
    if (span.parentSpanId == null) continue;
    const bucket = childrenByParent.get(span.parentSpanId);
    if (bucket) {
      bucket.push(span);
    } else {
      childrenByParent.set(span.parentSpanId, [span]);
    }
  }

  const visited = new Set<string>([anchor.spanId]);
  const descendants: T[] = [];
  // BFS so depth bounding is straightforward; visited set prevents
  // infinite loops on malformed (cyclic) parent chains.
  let frontier: T[] = [anchor];
  let depth = 0;
  while (frontier.length > 0) {
    if (maxDepth != null && depth >= maxDepth) break;
    const next: T[] = [];
    for (const span of frontier) {
      const children = childrenByParent.get(span.spanId);
      if (!children) continue;
      for (const child of children) {
        if (visited.has(child.spanId)) continue;
        visited.add(child.spanId);
        descendants.push(child);
        next.push(child);
      }
    }
    frontier = next;
    depth++;
  }

  // Sort descendants by startedAt; keep the anchor at index 0 regardless of
  // whether some descendant happens to have an earlier startedAt (clock skew,
  // out-of-order isEvent spans, etc).
  descendants.sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());
  return [anchor, ...descendants];
}

// ============================================================================
// Lightweight Span & Trace Schemas (for timeline rendering)
// ============================================================================

/** Maximum length of the rendered `inputPreview` / `outputPreview` text. */
export const PREVIEW_MAX_LENGTH = 100;

const inputPreviewField = z.string().describe('Short text preview of the span input');
const outputPreviewField = z.string().describe('Short text preview of the span output');

type PreviewMessage = { role?: string; content?: unknown };

/** The span fields a preview is derived from. Payloads may be parsed values or the JSON strings stores read back. */
export type SpanPreviewSource = Pick<SpanRecord, 'spanType'> &
  Partial<Pick<SpanRecord, 'metadata' | 'input' | 'output'>> & { attributes?: unknown };

function truncatePreview(text: string, maxLength: number): string | undefined {
  if (!text) return undefined;
  if (text.length <= maxLength) return text;
  const lastCode = text.charCodeAt(maxLength - 1);
  const end = lastCode >= 0xd800 && lastCode <= 0xdbff ? maxLength - 1 : maxLength;
  return `${text.slice(0, end)}…`;
}

function previewTextFromContent(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .map(part => {
      if (typeof part === 'string') return part;
      if (part && typeof part === 'object' && (part as { type?: unknown }).type === 'text') {
        const text = (part as { text?: unknown }).text;
        return typeof text === 'string' ? text : '';
      }
      return '';
    })
    .filter(Boolean)
    .join(' ');
}

const MALFORMED = Symbol('malformed');

/**
 * Parses a payload as stores hand it back. JSON documents are parsed; an unparseable
 * one is reported as malformed so it previews as empty (a best-effort scan of broken
 * JSON could surface text from the wrong message). A JSON-encoded scalar string is
 * unwrapped; anything else is plain text.
 */
function parsePreviewPayload(payload: unknown): unknown {
  if (typeof payload !== 'string') return payload;
  const trimmed = payload.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return MALFORMED;
    }
  }
  if (trimmed.startsWith('"')) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return payload;
    }
  }
  return payload;
}

const jsonPreview = (value: unknown) => JSON.stringify(value) ?? '';

/**
 * Builds the short text a trace list shows for a span's input, typed by span type:
 * the user turns of a message list, the prompt string, or JSON for anything else.
 */
export function buildSpanInputPreview(span: SpanPreviewSource, maxLength = PREVIEW_MAX_LENGTH): string | undefined {
  const input = parsePreviewPayload(span.input);
  if (input === MALFORMED || input == null) return undefined;

  const description = describeSpanInput({
    ...span,
    attributes: parsedAttributes(span.attributes),
    input,
  } as SpanRecord);
  if (!description) return undefined;

  switch (description.type) {
    case 'text':
      return truncatePreview(description.value, maxLength);
    case 'messages':
      return truncatePreview(
        (description.value as PreviewMessage[])
          .filter(m => m?.role === 'user')
          .map(m => previewTextFromContent(m.content))
          .filter(Boolean)
          .join(' | '),
        maxLength,
      );
    default:
      return truncatePreview(jsonPreview(description.value), maxLength);
  }
}

/**
 * Builds the short text a trace list shows for a span's output, typed by span type:
 * the result text of agent and model spans, the status of an interrupted run, or
 * JSON for anything else.
 */
function parsedAttributes(attributes: unknown): Record<string, unknown> | undefined {
  const parsed = parsePreviewPayload(attributes);
  return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : undefined;
}

/** A run that ended without output (e.g. a suspended workflow) records why in `attributes.status`. */
function pendingRunStatus(attributes: unknown): string | undefined {
  const status = parsedAttributes(attributes)?.status;
  return typeof status === 'string' && status !== 'running' && status !== 'success' ? status : undefined;
}

export function buildSpanOutputPreview(span: SpanPreviewSource, maxLength = PREVIEW_MAX_LENGTH): string | undefined {
  const output = parsePreviewPayload(span.output);
  if (output == null) return truncatePreview(pendingRunStatus(span.attributes) ?? '', maxLength);
  if (output === MALFORMED) return undefined;

  const description = describeSpanOutput({
    ...span,
    attributes: parsedAttributes(span.attributes),
    output,
  } as SpanRecord);
  if (!description) return undefined;

  switch (description.type) {
    case 'text':
      return truncatePreview(description.value, maxLength);
    case 'interrupted':
      return truncatePreview(description.value.status, maxLength);
    case 'agent-run-result':
    case 'model-generation-result':
    case 'model-step-result': {
      const text = (description.value as { text?: unknown }).text;
      return truncatePreview(typeof text === 'string' && text ? text : jsonPreview(description.value), maxLength);
    }
    default:
      return truncatePreview(jsonPreview(description.value), maxLength);
  }
}

/**
 * Raw trace-root row returned by the `listTraceRootRows` storage port: the light
 * fields plus the raw `input`/`output` payloads (parsed values or JSON strings).
 * The core turns these into previews; the payloads never leave the server.
 */
export type LightTraceRootRow = Omit<LightSpanRecord, 'inputPreview' | 'outputPreview' | 'status'> & {
  status?: LightSpanRecord['status'];
  input?: unknown;
  output?: unknown;
  attributes?: unknown;
};

/** Response of the `listTraceRootRows` storage port. */
export type ListTraceRootRowsResponse = Omit<ListTracesLightResponse, 'spans'> & { spans: LightTraceRootRow[] };

/** Maps a raw trace-root row to the lightweight record a trace list renders. */
export function toLightTraceRecord(row: LightTraceRootRow): LightSpanRecord {
  return {
    traceId: row.traceId,
    spanId: row.spanId,
    parentSpanId: row.parentSpanId,
    name: row.name,
    spanType: row.spanType,
    isEvent: row.isEvent,
    startedAt: row.startedAt,
    endedAt: row.endedAt,
    error: row.error,
    status: row.status ?? computeTraceStatus(row),
    entityType: row.entityType,
    entityId: row.entityId,
    entityName: row.entityName,
    threadId: row.threadId,
    resourceId: row.resourceId,
    metadata: row.metadata,
    inputPreview: buildSpanInputPreview(row) ?? null,
    outputPreview: buildSpanOutputPreview(row) ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * Lightweight span record containing only the fields trace lists and timelines render.
 * Excludes heavy fields: input, output, attributes, tags, links.
 * This keeps the per-span payload a small fraction of a full span record's.
 */
export const lightSpanRecordSchema = z
  .object({
    // Required identifiers
    ...spanIds,
    name: spanNameField,
    spanType: spanTypeField,
    isEvent: isEventField,
    startedAt: startedAtField,

    // Nullish fields needed for timeline/status
    parentSpanId: parentSpanIdField.nullish(),
    endedAt: endedAtField.nullish(),
    error: errorField.nullish(),

    // Computed status, so trace lists can render their status column.
    // Nullable AND optional: rows from stores/APIs that predate the field
    // may omit it entirely, and they must still validate.
    status: traceStatusField.nullable().optional(),

    // Entity context (needed by TraceSummaryDescription on root span)
    entityType: spanContextFields.entityType,
    entityId: spanContextFields.entityId,
    entityName: spanContextFields.entityName,

    // Memory context, so trace lists can render their Thread ID / Resource ID columns.
    // Nullable and optional for rows that predate the fields.
    threadId: spanContextFields.threadId.nullable(),
    resourceId: spanContextFields.resourceId.nullable(),

    // Span metadata, so user-configured metadata columns can render on the light list.
    // Nullable and optional for rows that predate the field.
    metadata: metadataField.nullable().optional(),

    // Short text preview of `input`, so trace lists can render their preview column
    // without transferring the whole prompt. See `buildSpanInputPreview`. Nullable and
    // optional for rows that predate the field.
    inputPreview: inputPreviewField.nullable().optional(),

    // Short text preview of `output`. See `buildSpanOutputPreview`.
    outputPreview: outputPreviewField.nullable().optional(),

    // Database timestamps
    ...dbTimestamps,
  })
  .describe('Lightweight span record for trace lists and timelines (excludes input, output, attributes, tags, links)');

/** Lightweight span record for timeline rendering */
export type LightSpanRecord = z.infer<typeof lightSpanRecordSchema>;

/**
 * Response schema for getStructure operation.
 * Returns a trace with lightweight spans (only fields needed for timeline).
 */
export const getStructureResponseSchema = z.object({
  traceId: traceIdField,
  spans: z.array(lightSpanRecordSchema),
});

/** Response containing a trace with lightweight spans for timeline rendering */
export type GetStructureResponse = z.infer<typeof getStructureResponseSchema>;

/** @deprecated Use {@link getStructureResponseSchema} instead. */
export const getTraceLightResponseSchema = getStructureResponseSchema;
/** @deprecated Use {@link GetStructureResponse} instead. */
export type GetTraceLightResponse = GetStructureResponse;

/** Schema for filtering traces in list queries */
export const tracesFilterSchema = z
  .object({
    // Date range filters
    startedAt: dateRangeSchema.optional().describe('Filter by span start time range'),
    endedAt: dateRangeSchema.optional().describe('Filter by span end time range'),

    // Span type filter
    spanType: spanTypeField.optional(),

    // Identifier filter (matches the root span's trace identifier)
    traceId: traceIdField.optional().describe('Filter by trace ID (matches root span)'),

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
    mode: listModeSchema.optional(),
    filters: tracesFilterSchema.optional().describe('Optional filters to apply'),
    pagination: paginationArgsSchema.optional(),
    orderBy: tracesOrderBySchema.optional(),
    after: deltaCursorSchema.optional(),
    limit: deltaLimitSchema,
  })
  .strict()
  .superRefine(refineObservabilityListMode)
  .transform(value =>
    normalizeObservabilityListArgs<z.output<typeof tracesFilterSchema>, z.output<typeof tracesOrderBySchema>>(value, {
      orderBy: { field: 'startedAt', direction: 'DESC' } as const,
    }),
  )
  .describe('Arguments for listing traces.');

/** Arguments for listing traces with optional filters, pagination, and ordering */
export type ListTracesArgs = z.input<typeof listTracesArgsSchema>;

/** Schema for listTraces operation response */
export const listTracesResponseSchema = z.object({
  pagination: paginationInfoSchema.optional(),
  delta: deltaInfoSchema.optional(),
  deltaCursor: deltaCursorSchema.optional(),
  spans: z.array(traceSpanSchema),
});

/** Response containing paginated root spans with computed status. Trace delta mode returns only new trace rows. */
export type ListTracesResponse = z.infer<typeof listTracesResponseSchema>;

/** Schema for listTracesLight operation response */
export const listTracesLightResponseSchema = z.object({
  pagination: paginationInfoSchema.optional(),
  delta: deltaInfoSchema.optional(),
  deltaCursor: deltaCursorSchema.optional(),
  spans: z.array(lightSpanRecordSchema),
});

/** Response containing paginated lightweight root spans. Delta mode returns only new trace rows. */
export type ListTracesLightResponse = z.infer<typeof listTracesLightResponseSchema>;

// ============================================================================
// Trace branches (anchor spans surfaced as listable rows, including non-root)
// ============================================================================

/**
 * Span types that anchor a listable trace branch -- the spans a user thinks
 * about when looking for a specific run (agent/workflow/tool/etc.),
 * regardless of whether the entity ran as the root of its trace or nested
 * under a parent. Each row in {@link listBranchesArgsSchema} corresponds to
 * one such anchor span; the subtree below it is fetched via
 * {@link getBranchArgsSchema}.
 *
 * Excludes sub-operation spans (model_step, workflow_step, scorer_step,
 * memory_operation, rag_*, etc.) which are internal to a containing branch
 * rather than separately listable.
 */
export const BRANCH_SPAN_TYPES = [
  SpanType.AGENT_RUN,
  SpanType.WORKFLOW_RUN,
  SpanType.PROCESSOR_RUN,
  SpanType.SCORER_RUN,
  SpanType.RAG_INGESTION,
  SpanType.TOOL_CALL,
  SpanType.MCP_TOOL_CALL,
  SpanType.MCP_SERVER_REQUEST,
  SpanType.PROVIDER_TOOL_CALL,
] as const satisfies readonly SpanType[];

/** Set form of {@link BRANCH_SPAN_TYPES} for fast membership checks. */
export const BRANCH_SPAN_TYPE_SET: ReadonlySet<SpanType> = new Set(BRANCH_SPAN_TYPES);

/** Schema for filtering branch anchor spans in list queries. */
export const branchesFilterSchema = z
  .object({
    // Date range filters apply to the branch anchor span itself
    startedAt: dateRangeSchema.optional().describe('Filter by span start time range'),
    endedAt: dateRangeSchema.optional().describe('Filter by span end time range'),

    // Narrow within the branch span-type set; if omitted, all of them match
    spanType: spanTypeField.optional(),

    // Identifier filters
    traceId: traceIdField.optional().describe('Filter by parent trace ID'),

    // Per-span context fields (apply to the anchor span, not the trace root)
    ...sharedFields,

    // Derived status filter (computed from this anchor's own error/endedAt)
    status: traceStatusField.optional(),
  })
  .describe('Filters for querying trace branches');

export const branchesOrderByFieldSchema = z
  .enum(['startedAt', 'endedAt'])
  .describe("Field to order by: 'startedAt' | 'endedAt'");

export const branchesOrderBySchema = z
  .object({
    field: branchesOrderByFieldSchema.default('startedAt').describe('Field to order by'),
    direction: sortDirectionSchema.default('DESC').describe('Sort direction'),
  })
  .describe('Order by configuration');

/**
 * Arguments for listing trace branches.
 *
 * Each row is a single branch anchor span ({@link BRANCH_SPAN_TYPES}),
 * including ones nested under a different root entity. Use this when you
 * want every run of a given agent/processor/tool regardless of how it was
 * triggered. Use {@link listTracesArgsSchema} when you want one row per
 * trace, and {@link getBranchArgsSchema} to expand a single branch into its
 * subtree.
 */
export const listBranchesArgsSchema = z
  .object({
    mode: listModeSchema.optional(),
    filters: branchesFilterSchema.optional().describe('Optional filters to apply'),
    pagination: paginationArgsSchema.optional(),
    orderBy: branchesOrderBySchema.optional(),
    after: deltaCursorSchema.optional(),
    limit: deltaLimitSchema,
  })
  .strict()
  .superRefine(refineObservabilityListMode)
  .transform(value =>
    normalizeObservabilityListArgs<z.output<typeof branchesFilterSchema>, z.output<typeof branchesOrderBySchema>>(
      value,
      {
        orderBy: { field: 'startedAt', direction: 'DESC' } as const,
      },
    ),
  )
  .describe('Arguments for listing trace branches.');

/** Arguments for listing branches with optional filters, pagination, and ordering */
export type ListBranchesArgs = z.input<typeof listBranchesArgsSchema>;

/**
 * Schema for listBranches operation response. Each row is a single branch
 * anchor span -- repeated runs of the same entity within one parent trace
 * surface as separate rows.
 */
export const listBranchesResponseSchema = z.object({
  pagination: paginationInfoSchema.optional(),
  delta: deltaInfoSchema.optional(),
  deltaCursor: deltaCursorSchema.optional(),
  branches: z.array(traceSpanSchema),
});

/** Response containing paginated branch anchor spans with computed status. Branch delta mode returns only new branch rows. */
export type ListBranchesResponse = z.infer<typeof listBranchesResponseSchema>;

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

/** Maximum number of trace IDs accepted by a single batch delete request. */
export const BATCH_DELETE_TRACES_MAX_IDS = 1000;

/**
 * Schema for batchDeleteTraces operation arguments
 */
export const batchDeleteTracesArgsSchema = z
  .object({
    traceIds: z
      .array(traceIdField)
      .max(BATCH_DELETE_TRACES_MAX_IDS)
      .describe(`Trace IDs to delete (maximum ${BATCH_DELETE_TRACES_MAX_IDS})`),
    organizationId: organizationIdField
      .optional()
      .describe('Optional tenant scope: only delete rows belonging to this organization'),
    resourceId: resourceIdField
      .optional()
      .describe('Optional tenant scope: only delete rows belonging to this resource'),
  })
  .describe('Arguments for batch deleting traces');

/** Arguments for batch deleting multiple traces */
export type BatchDeleteTracesArgs = z.infer<typeof batchDeleteTracesArgsSchema>;

/** Schema for batchDeleteTraces route response */
export const batchDeleteTracesResponseSchema = z
  .object({
    success: z.literal(true),
  })
  .describe('Response for batch deleting traces');

/** Response for batch deleting traces */
export type BatchDeleteTracesResponse = z.infer<typeof batchDeleteTracesResponseSchema>;

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
