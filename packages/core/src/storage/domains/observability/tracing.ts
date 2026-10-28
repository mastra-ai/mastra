import { z } from 'zod/v4';
import { scoreRowDataSchema } from '../../../evals/types';
import { spanStopReasonContextSchema } from '../../../observability/outcome-schema';
import { PREVIEW_MAX_LENGTH, truncatePreview } from '../../../observability/span-previews';
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

    // Short text previews of input / output / error (see `buildPreview`). When a written span
    // carries them (e.g. built upstream by an exporter), stores that keep previews store these,
    // cut to the shared format, instead of building their own.
    inputPreview: z.string().nullish().describe('Short text preview of the span input'),
    outputPreview: z.string().nullish().describe('Short text preview of the span output'),
    errorPreview: z.string().nullish().describe('Short text preview of the span error'),

    // Derived from `attributes.completionStartTime` when an exporter builds the record, so stores
    // persist it without computing it themselves.
    timeToFirstChunkMs: z
      .number()
      .nullish()
      .describe('Milliseconds from span start to the first streamed chunk; null when the span never streamed one'),

    // Producer-supplied termination fields shared by the exporter record contract.
    outcome: z.string().nullish(),
    stopReason: z.string().nullish(),
    stopReasonContext: spanStopReasonContextSchema.nullish(),

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

export { PREVIEW_MAX_LENGTH } from '../../../observability/span-previews';

/** @deprecated Use {@link PREVIEW_MAX_LENGTH}. */
export const INPUT_PREVIEW_MAX_LENGTH = PREVIEW_MAX_LENGTH;

const inputPreviewField = z.string().describe('Short text preview of the span input');
const outputPreviewField = z.string().describe('Short text preview of the span output');
const errorPreviewField = z.string().describe('Short text preview of the span error');

type PreviewMessage = { role?: unknown; content?: unknown };

function isMessage(value: unknown): value is PreviewMessage {
  return value != null && typeof value === 'object' && typeof (value as PreviewMessage).role === 'string';
}

/** A message list is a bare array or a `messages` array whose elements carry a string `role`. */
function extractMessages(value: unknown): PreviewMessage[] | null {
  const list =
    value && typeof value === 'object' && !Array.isArray(value) && 'messages' in value
      ? (value as { messages: unknown }).messages
      : value;
  return Array.isArray(list) && list.some(isMessage) ? list : null;
}

function textFromContent(content: unknown): string {
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

/**
 * Preview of an agent signal recorded as a run's input (`agent.sendSignal()`): a user signal previews
 * as its text, any other signal as its text labelled by what it is (`Skill <name>: …`, `<tag>: …`).
 */
function signalText(value: object): string | null {
  const signal = value as Record<string, unknown>;
  if (signal.__isCreatedSignal !== true || !('contents' in signal)) return null;
  const text = textFromContent(signal.contents).trim();
  const type = signal.type;
  if (type === 'user' || type === 'user-message') return text || null;

  const attributes = signal.attributes as Record<string, unknown> | undefined;
  const tagName = typeof signal.tagName === 'string' ? signal.tagName : undefined;
  const label =
    tagName === 'skill' && typeof attributes?.name === 'string'
      ? `Skill ${attributes.name}`
      : (tagName ?? (typeof type === 'string' ? type : 'signal'));
  return text ? `${label}: ${text}` : label;
}

function lastMessageText(messages: PreviewMessage[], accept: (role: string) => boolean): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (!isMessage(message) || !accept(message.role as string)) continue;
    const text = textFromContent(message.content).trim();
    if (text) return text;
  }
  return null;
}

function textField(value: object): string | null {
  for (const key of ['text', 'message'] as const) {
    const field = (value as Record<string, unknown>)[key];
    if (typeof field === 'string' && field.trim()) return field;
  }
  return null;
}

/**
 * Short text preview of a decoded span payload (`input`, `output` or `error`), at most
 * {@link PREVIEW_MAX_LENGTH} characters plus `…` when cut. Returns `null` when there is nothing
 * to preview.
 *
 * - A string previews as itself.
 * - A message list (a bare array, or a `messages` array, of objects with a string `role`)
 *   previews as the last user message's text, else the last non-system message's text.
 * - An agent signal (a run started by `agent.sendSignal()`) previews as its contents; a non-user
 *   signal is labelled by its tag, or `Skill <name>` for a skill.
 * - An object with a non-blank `text` or `message` string previews as that string.
 * - Anything else previews as its compact JSON.
 *
 * `serialized` is the value's JSON text when the caller already has it, so the compact-JSON
 * case does not serialize it twice. Writers call this on the value they store; readers of a
 * stored JSON column call {@link buildPreviewFromJson}, so both produce the same preview.
 */
export function buildPreview(value: unknown, serialized?: string | null): string | null {
  return previewOf(value, serialized, PREVIEW_MAX_LENGTH);
}

function previewOf(value: unknown, serialized: string | null | undefined, maxLength: number): string | null {
  if (value == null) return null;
  if (typeof value === 'string') return truncatePreview(value, maxLength);

  const messages = extractMessages(value);
  if (messages) {
    const text =
      lastMessageText(messages, role => role === 'user') ?? lastMessageText(messages, role => role !== 'system');
    return text == null ? null : truncatePreview(text, maxLength);
  }

  if (typeof value === 'object' && !Array.isArray(value)) {
    const text = signalText(value) ?? textField(value);
    if (text != null) return truncatePreview(text, maxLength);
  }

  return truncatePreview(serialized ?? JSON.stringify(value) ?? '', maxLength);
}

/**
 * Preview of a stored JSON payload column. Stores always write valid JSON, so text that does not
 * parse previews as blank rather than as a guess at a sliced document.
 */
export function buildPreviewFromJson(json: string | null | undefined): string | null {
  return previewOfJson(json, PREVIEW_MAX_LENGTH);
}

function previewOfJson(json: string | null | undefined, maxLength: number): string | null {
  if (json == null || !json.trim()) return null;
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    return null;
  }
  return previewOf(value, json, maxLength);
}

/**
 * The preview a store writes for one payload: an upstream preview when the span record carries
 * a string (including an intentionally empty one), otherwise one built from the payload. Both are capped the same way, at
 * {@link PREVIEW_MAX_LENGTH} characters plus `…`, so an exporter can't store an unbounded preview.
 * `''` means there is nothing to preview.
 */
export function buildStoredPreview(
  upstream: string | null | undefined,
  value: unknown,
  serialized?: string | null,
): string {
  if (upstream != null) return truncatePreview(upstream) ?? '';
  return buildPreview(value, serialized) ?? '';
}

/**
 * Whether a preview built by {@link buildPreview} was cut. A cut preview is the first
 * {@link PREVIEW_MAX_LENGTH} characters plus `…`, or one character fewer plus `…` when the cut
 * would split a surrogate pair; an uncut one is at most {@link PREVIEW_MAX_LENGTH} characters.
 * An uncut text of exactly {@link PREVIEW_MAX_LENGTH} characters that itself ends in `…` reads as
 * cut, which is the one case the preview alone cannot tell apart.
 */
export function isPreviewTruncated(preview: string | null | undefined): boolean {
  if (!preview) return false;
  return preview.endsWith('…') && (preview.length === PREVIEW_MAX_LENGTH || preview.length === PREVIEW_MAX_LENGTH + 1);
}

/**
 * @deprecated Use {@link buildPreview} (decoded values) or {@link buildPreviewFromJson} (stored
 * JSON text). Kept for callers of the old trace-list preview; it now uses the shared preview
 * format, so a message list previews as its last user message rather than every user message
 * joined with ` | `.
 *
 * Accepts a decoded value or a JSON string. A string that looks like a JSON document or a
 * JSON-encoded scalar is parsed first; an unparseable JSON document previews as empty.
 * `maxLength` caps the preview at that many characters plus `…`, as before.
 */
export function buildInputPreview(input: unknown, maxLength = PREVIEW_MAX_LENGTH): string | undefined {
  if (input == null) return undefined;
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) return previewOfJson(trimmed, maxLength) ?? undefined;
    if (trimmed.startsWith('"')) {
      try {
        return previewOf(JSON.parse(trimmed), undefined, maxLength) ?? undefined;
      } catch {
        // Not valid JSON — treat as plain text below.
      }
    }
  }
  return previewOf(input, undefined, maxLength) ?? undefined;
}

/** Stored preview when the record carries one (`''` means none), else one built from the value. */
function lightPreview(stored: string | null | undefined, value: unknown): string | null {
  return stored == null ? buildPreview(value) : stored.trim() || null;
}

/**
 * Projects a full span record down to the lightweight row a trace list renders,
 * with `inputPreview` / `outputPreview` / `errorPreview`: the stored previews when the record
 * carries them, otherwise built from `input` / `output` / `error` with {@link buildPreview}.
 *
 * This is the read-time fallback. Backends that can project inside the query should
 * do so instead — that is what keeps the blob columns off the read path — but every
 * backend can serve a correct lightweight list through this.
 */
export function toLightSpanRecord(span: SpanRecord): LightSpanRecord {
  return {
    traceId: span.traceId,
    spanId: span.spanId,
    parentSpanId: span.parentSpanId,
    name: span.name,
    spanType: span.spanType,
    isEvent: span.isEvent,
    startedAt: span.startedAt,
    endedAt: span.endedAt,
    error: span.error,
    status: computeTraceStatus(span),
    entityType: span.entityType,
    entityId: span.entityId,
    entityName: span.entityName,
    threadId: span.threadId,
    resourceId: span.resourceId,
    metadata: span.metadata,
    inputPreview: lightPreview(span.inputPreview, span.input),
    outputPreview: lightPreview(span.outputPreview, span.output),
    errorPreview: lightPreview(span.errorPreview, span.error),
    createdAt: span.createdAt,
    updatedAt: span.updatedAt,
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

    // Short text previews of `input` / `output` / `error`, so trace lists can render their
    // preview columns without transferring the whole payload. See `buildPreview`. Nullable
    // and optional for rows that predate the fields.
    inputPreview: inputPreviewField.nullable().optional(),
    outputPreview: outputPreviewField.nullable().optional(),
    errorPreview: errorPreviewField.nullable().optional(),

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

/** Result of a conditional batch span update: the spans whose rows were changed. */
export interface BatchUpdateUnendedSpansResponse {
  updated: Array<{ traceId: string; spanId: string }>;
}

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
