/**
 * OBS-526 contract prototype. Deliberately not exported from the storage barrel or
 * wired into a store/capability/route. Promoting this contract is subsequent work.
 *
 * Initial visibility: completed records only, consistent with insert-only ClickHouse.
 * Current-record selection precedes mutable predicates and pagination. A store must
 * define its version rule; endedAt alone is not a general-purpose revision number.
 */
import { z } from 'zod/v4';
import {
  digestBinding,
  findPredicateComplexityIssue,
  formatTraceQuerySchemaIssues,
  normalizeTraceQueryTenantScope,
  planSpanQuerySelectionPredicate,
  TRACE_QUERY_PREDICATE_COMPLEXITY_MESSAGE,
  TraceQueryCursorError,
  TraceQueryValidationError,
  traceQueryScalarPredicateSchema,
  traceQueryTimeRangeSchema,
} from './trace-query';
import type { TraceQueryIssue, TraceQueryPlanOptions, TrustedTraceQueryScalarPredicate } from './trace-query';

export const SPAN_QUERY_MAX_PREVIEW_CHARACTERS = 256;
export const SPAN_QUERY_MAX_LIMIT = 1000;
export const SPAN_QUERY_MAX_CURSOR_BYTES = 8192;
const timestamp = z.string().datetime({ offset: true });
const identifier = z.string().min(1).max(512);

const timeRangeSchema = traceQueryTimeRangeSchema.superRefine((range, context) => {
  const duration = Date.parse(range.to) - Date.parse(range.from);
  if (duration <= 0 || duration > 31 * 24 * 60 * 60 * 1000) {
    context.addIssue({ code: 'custom', message: 'The time range must be positive and at most 31 days' });
  }
});

const requestSchema = z
  .object({
    timeRange: timeRangeSchema,
    where: traceQueryScalarPredicateSchema.optional(),
    orderBy: z
      .array(z.object({ field: z.enum(['startedAt', 'endedAt']), direction: z.enum(['asc', 'desc']) }).strict())
      .length(1)
      .default([{ field: 'startedAt', direction: 'desc' }]),
    page: z
      .object({
        limit: z.number().int().min(1).max(SPAN_QUERY_MAX_LIMIT).default(100),
        after: z.string().min(1).max(SPAN_QUERY_MAX_CURSOR_BYTES).optional(),
      })
      .strict()
      .default({ limit: 100 }),
  })
  .strict();

export const spanQueryRequestSchema = z.preprocess((input, context) => {
  const path = findPredicateComplexityIssue(input, [['where']]);
  if (path) {
    context.addIssue({ code: 'custom', path, message: TRACE_QUERY_PREDICATE_COMPLEXITY_MESSAGE });
    return z.NEVER;
  }
  return input;
}, requestSchema);

// Nullable scope fields keep local OSS spans addressable without inventing a tenant.
// Platform must supply trusted scope externally; the request cannot supply it.
export const spanQueryIdentitySchema = z
  .object({
    organizationId: identifier.nullable(),
    resourceId: identifier.nullable(),
    traceId: identifier,
    spanId: identifier,
  })
  .strict();

export const spanQueryCostSchema = z.discriminatedUnion('state', [
  z
    .object({ state: z.literal('available'), amount: z.number().nonnegative(), currency: z.string().min(1).max(16) })
    .strict(),
  z.object({ state: z.literal('missing') }).strict(),
  z.object({ state: z.literal('unavailable') }).strict(),
]);

const previewSchema = z
  .string()
  .refine(value => [...value].length <= SPAN_QUERY_MAX_PREVIEW_CHARACTERS, 'Preview exceeds its character limit')
  .nullable();

export const spanQueryRowSchema = spanQueryIdentitySchema
  .extend({
    parentSpanId: identifier.nullable(),
    name: z.string(),
    spanType: z.string(),
    status: z.enum(['success', 'error']),
    startedAt: timestamp,
    endedAt: timestamp,
    durationMs: z.number().nonnegative(),
    entityType: z.string().nullable(),
    entityId: z.string().nullable(),
    entityName: z.string().nullable(),
    model: z.string().nullable(),
    provider: z.string().nullable(),
    inputPreview: previewSchema,
    inputTruncated: z.boolean(),
    outputPreview: previewSchema,
    outputTruncated: z.boolean(),
    cost: spanQueryCostSchema,
  })
  .superRefine((row, context) => {
    const duration = Date.parse(row.endedAt) - Date.parse(row.startedAt);
    // Date.parse truncates each timestamp to milliseconds; store durations may retain
    // sub-millisecond precision, so their difference can be strictly less than 1 ms.
    if (duration < 0 || Math.abs(row.durationMs - duration) >= 1) {
      context.addIssue({
        code: 'custom',
        path: ['durationMs'],
        message: 'Duration must match the completed span timestamps',
      });
    }
    for (const field of ['input', 'output'] as const) {
      if (row[`${field}Preview`] === null && row[`${field}Truncated`]) {
        context.addIssue({
          code: 'custom',
          path: [`${field}Truncated`],
          message: 'An absent preview cannot be truncated',
        });
      }
    }
  });

export const spanQueryResponseSchema = z
  .object({
    spans: z.array(spanQueryRowSchema).max(SPAN_QUERY_MAX_LIMIT),
    page: z
      .object({
        // Base64url is ASCII, so string length also enforces the byte limit.
        next: z
          .string()
          .min(1)
          .max(SPAN_QUERY_MAX_CURSOR_BYTES)
          .regex(/^[A-Za-z0-9_-]+$/)
          .nullable(),
      })
      .strict(),
  })
  .strict()
  .superRefine((response, context) => {
    const keys = response.spans.map(row =>
      JSON.stringify([row.organizationId, row.resourceId, row.traceId, row.spanId]),
    );
    if (new Set(keys).size !== keys.length) {
      context.addIssue({
        code: 'custom',
        path: ['spans'],
        message: 'A page must contain unique scoped span identities',
      });
    }
  });

export type SpanQueryRequest = z.input<typeof requestSchema>;
export type NormalizedSpanQueryRequest = z.output<typeof requestSchema>;
export type SpanQueryIdentity = z.infer<typeof spanQueryIdentitySchema>;
export type SpanQueryRow = z.infer<typeof spanQueryRowSchema>;
export type SpanQueryResponse = z.infer<typeof spanQueryResponseSchema>;

const cursorValuesSchema = spanQueryIdentitySchema.extend({ sortValue: timestamp }).strict();
const cursorEnvelopeSchema = z
  .object({
    version: z.literal(1),
    result: z.literal('spans'),
    binding: z.string().length(64),
    values: cursorValuesSchema,
  })
  .strict();

/**
 * Ordering semantics every store compiler must implement:
 * - Sort by `orderBy.field` in the requested direction, then break ties by
 *   organizationId, resourceId, traceId, and spanId, in that order, all ascending.
 * - Compare non-null IDs lexicographically by UTF-8 bytes, without locale collation.
 *   Null organizationId/resourceId values sort last and compare equal to other nulls.
 * - Resume strictly after the cursor using that same complete ordering. Apply the
 *   requested direction only to the timestamp; identity tie-breaks remain ascending.
 *   Use null-safe equality/comparison for tenant fields, not a raw nullable SQL tuple.
 * - Select and page unique current span identities before hydrating previews or cost.
 */
export interface TrustedSpanQueryPlan {
  result: 'spans';
  timeRange: { from: string; to: string };
  where?: TrustedTraceQueryScalarPredicate;
  scope?: TraceQueryPlanOptions['scope'];
  orderBy: NormalizedSpanQueryRequest['orderBy'][number];
  limit: number;
  binding: string;
  cursor?: z.infer<typeof cursorValuesSchema>;
}

export function parseSpanQueryRequest(input: unknown): NormalizedSpanQueryRequest {
  const parsed = spanQueryRequestSchema.safeParse(input);
  if (!parsed.success) throw new TraceQueryValidationError(formatTraceQuerySchemaIssues(parsed.error));
  return parsed.data;
}

/** Host authorization is separate from the query document; a binding is not an authorization grant. */
export function planSpanQuery(input: unknown, options: TraceQueryPlanOptions = {}): TrustedSpanQueryPlan {
  const request = parseSpanQueryRequest(input);
  const issues: TraceQueryIssue[] = [];
  const where = request.where ? planSpanQuerySelectionPredicate(request.where, issues) : undefined;
  if (issues.length) throw new TraceQueryValidationError(issues);
  const scope = normalizeTraceQueryTenantScope(options.scope);
  const timeRange = {
    from: new Date(request.timeRange.from).toISOString(),
    to: new Date(request.timeRange.to).toISOString(),
  };
  const orderBy = request.orderBy[0]!;
  // Page size may change without invalidating a cursor.
  const binding = digestBinding({
    version: 1,
    result: 'spans',
    timeRange,
    where,
    orderBy,
    scope,
    authorization: options.authorizationBinding,
  });
  let cursor: TrustedSpanQueryPlan['cursor'];
  if (request.page.after) {
    let decoded: unknown;
    try {
      if (!/^[A-Za-z0-9_-]+$/.test(request.page.after)) throw new Error('Invalid base64url');
      decoded = JSON.parse(Buffer.from(request.page.after, 'base64url').toString('utf8'));
    } catch {
      throw new TraceQueryCursorError('TRACE_QUERY_CURSOR_MALFORMED');
    }
    const envelope = cursorEnvelopeSchema.safeParse(decoded);
    if (!envelope.success) throw new TraceQueryCursorError('TRACE_QUERY_CURSOR_MALFORMED');
    if (envelope.data.binding !== binding) throw new TraceQueryCursorError('TRACE_QUERY_CURSOR_CONFLICT');
    cursor = { ...envelope.data.values, sortValue: new Date(envelope.data.values.sortValue).toISOString() };
    if (
      scope &&
      (cursor.organizationId !== scope.organizationId ||
        (scope.resourceId !== undefined && cursor.resourceId !== scope.resourceId))
    ) {
      throw new TraceQueryCursorError('TRACE_QUERY_CURSOR_CONFLICT');
    }
  }
  return { result: 'spans', timeRange, where, scope, orderBy, limit: request.page.limit, binding, cursor };
}

export function encodeSpanQueryCursor(plan: TrustedSpanQueryPlan, values: z.infer<typeof cursorValuesSchema>): string {
  const envelope = cursorEnvelopeSchema.parse({ version: 1, result: 'spans', binding: plan.binding, values });
  const result = Buffer.from(JSON.stringify(envelope), 'utf8').toString('base64url');
  if (result.length > SPAN_QUERY_MAX_CURSOR_BYTES) throw new TraceQueryCursorError('TRACE_QUERY_CURSOR_MALFORMED');
  return result;
}

/** Raw-text fallback for already-selected payloads, not an unbounded JSON parser/serializer. */
export function createSpanQueryPreview(value: string | null): { value: string | null; truncated: boolean } {
  if (value === null) return { value: null, truncated: false };
  let characters = 0;
  let preview = '';
  for (const character of value) {
    characters += 1;
    if (characters > SPAN_QUERY_MAX_PREVIEW_CHARACTERS) {
      return { value: preview, truncated: true };
    }
    preview += character;
  }
  return { value: preview, truncated: false };
}
