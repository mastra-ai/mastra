/**
 * Storage contract for querying individual completed spans across traces.
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
  isTraceQuerySortValueFor,
  normalizeTraceQueryTenantScope,
  planSpanQuerySelectionPredicate,
  TRACE_QUERY_ORDER_FIELDS,
  TRACE_QUERY_PREDICATE_COMPLEXITY_MESSAGE,
  TraceQueryCursorError,
  TraceQueryValidationError,
  traceQueryScalarPredicateSchema,
  traceQuerySortValueSchema,
  traceQueryTimeRangeSchema,
} from './trace-query';
import type { TraceQueryIssue, TraceQueryPlanOptions, TrustedTraceQueryScalarPredicate } from './trace-query';
import { isPreviewTruncated } from './tracing';

/**
 * @deprecated Span query previews use the shared preview format (`buildPreview`), at most
 * `PREVIEW_MAX_LENGTH` characters plus `…`.
 */
export const SPAN_QUERY_MAX_PREVIEW_CHARACTERS = 256;
export const SPAN_QUERY_MAX_LIMIT = 1000;
export const SPAN_QUERY_MAX_CURSOR_BYTES = 8192;
const timestamp = z.string().datetime({ offset: true });
const identifier = z.string().min(1).max(512);

const timeRangeSchema = traceQueryTimeRangeSchema.superRefine((range, context) => {
  const duration = Date.parse(range.to) - Date.parse(range.from);
  if (duration <= 0) {
    context.addIssue({ code: 'custom', message: 'The time range must be positive' });
  }
});

const requestSchema = z
  .object({
    timeRange: timeRangeSchema,
    where: traceQueryScalarPredicateSchema.optional(),
    orderBy: z
      .array(z.object({ field: z.enum(TRACE_QUERY_ORDER_FIELDS), direction: z.enum(['asc', 'desc']) }).strict())
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

// Supplied previews are not length-limited; only automatic generation is bounded.
const previewSchema = z.string().nullable();

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
    // Older adapters omit these fields; keep mixed-version responses readable.
    entityVersionId: z.string().nullable().default(null),
    parentEntityType: z.string().nullable().default(null),
    parentEntityId: z.string().nullable().default(null),
    parentEntityName: z.string().nullable().default(null),
    parentEntityVersionId: z.string().nullable().default(null),
    rootEntityType: z.string().nullable().default(null),
    rootEntityId: z.string().nullable().default(null),
    rootEntityName: z.string().nullable().default(null),
    rootEntityVersionId: z.string().nullable().default(null),
    threadId: z.string().nullable().default(null),
    runId: z.string().nullable().default(null),
    sessionId: z.string().nullable().default(null),
    userId: z.string().nullable().default(null),
    requestId: z.string().nullable().default(null),
    serviceName: z.string().nullable().default(null),
    experimentId: z.string().nullable().default(null),
    environment: z.string().nullable().default(null),
    executionSource: z.string().nullable().default(null),
    model: z.string().nullable(),
    provider: z.string().nullable(),
    inputPreview: previewSchema,
    outputPreview: previewSchema,
    errorPreview: previewSchema,
    /**
     * Time from the span's start to its first model response chunk; `null` when it never
     * streamed one. Absent when the store lacks the `trace-query-time-to-first-chunk` feature.
     */
    timeToFirstChunkMs: z.number().nullable().optional(),
    outcome: z.string().nullish(),
    stopReason: z.string().nullish(),
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

const cursorValuesSchema = spanQueryIdentitySchema.extend({ sortValue: traceQuerySortValueSchema }).strict();
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
 *   Empty `timeToFirstChunkMs` values sort last in both directions and tie with each other.
 * - Compare non-null IDs lexicographically by UTF-8 bytes, without locale collation.
 *   Null organizationId/resourceId values sort last and compare equal to other nulls.
 * - Resume strictly after the cursor using that same complete ordering. Apply the
 *   requested direction only to the sort value; identity tie-breaks remain ascending.
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
    const { sortValue } = envelope.data.values;
    if (!isTraceQuerySortValueFor(orderBy.field, sortValue))
      throw new TraceQueryCursorError('TRACE_QUERY_CURSOR_MALFORMED');
    cursor = {
      ...envelope.data.values,
      sortValue: typeof sortValue === 'string' ? new Date(sortValue).toISOString() : sortValue,
    };
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

/**
 * Span query preview from a stored preview (see `buildPreview`): `''` (nothing to preview) and
 * `null` become `null`, and `truncated` says whether the preview was cut.
 */
export function createSpanQueryPreview(preview: string | null): { value: string | null; truncated: boolean } {
  if (!preview) return { value: null, truncated: false };
  return { value: preview, truncated: isPreviewTruncated(preview) };
}

/** @internal Identity shared by page hydration and metric attribution. */
export function spanQueryIdentityKey(identity: SpanQueryIdentity): string {
  return JSON.stringify([identity.organizationId, identity.resourceId, identity.traceId, identity.spanId]);
}

/** @internal Bounded, deduplicated token metrics used to resolve per-span model cost. */
export interface SpanQueryCostMetric extends SpanQueryIdentity {
  name: string;
  estimatedCost: number | null;
  costUnit: string | null;
  allocation: string | null;
  costError: boolean;
}

/** @internal Fail rather than return a partial, misleading cost for an oversized page. */
export const SPAN_QUERY_MAX_COST_METRICS = 50_000;

/**
 * @internal Total token metrics are authoritative; detail metrics overlap them.
 * A provider-supplied query_total carrier replaces both directional totals.
 * Missing means no token metrics have arrived; partial/unpriced/ambiguous cost is unavailable.
 */
export function resolveSpanQueryCost(metrics: SpanQueryCostMetric[]): z.infer<typeof spanQueryCostSchema> {
  if (!metrics.length) return { state: 'missing' };
  const names = ['mastra_model_total_input_tokens', 'mastra_model_total_output_tokens'];
  const totals = metrics.filter(metric => names.includes(metric.name));
  if (!totals.length || totals.some(metric => metric.costError)) return { state: 'unavailable' };
  const carriers = totals.filter(metric => metric.allocation === 'query_total');
  let selected = totals;
  if (carriers.length) {
    if (carriers.length !== 1 || totals.some(metric => metric !== carriers[0] && metric.estimatedCost !== null)) {
      return { state: 'unavailable' };
    }
    selected = carriers;
  } else if (totals.length !== 2 || new Set(totals.map(metric => metric.name)).size !== 2) {
    return { state: 'unavailable' };
  }
  const currency = selected[0]!.costUnit;
  if (
    !currency ||
    currency.length > 16 ||
    selected.some(
      metric =>
        metric.costUnit !== currency ||
        metric.estimatedCost === null ||
        !Number.isFinite(metric.estimatedCost) ||
        metric.estimatedCost < 0,
    )
  )
    return { state: 'unavailable' };
  const amount = selected.reduce((sum, metric) => sum + metric.estimatedCost!, 0);
  return Number.isFinite(amount) ? { state: 'available', amount, currency } : { state: 'unavailable' };
}

/** @internal Selected page metadata; adapters normalize dates to ISO strings. */
export type SpanQuerySelectedRow = Omit<SpanQueryRow, 'inputPreview' | 'outputPreview' | 'errorPreview'>;

/**
 * @internal Previews built by `buildPreview`: the stored preview columns, or for rows written
 * before a store kept them, a preview built from the payload column.
 */
export interface SpanQueryPayload extends SpanQueryIdentity {
  inputPreview: string | null;
  outputPreview: string | null;
  errorPreview: string | null;
}

/** @internal Hydration never changes the selected page's order or cursor boundary. */
export function buildSpanQueryResponse(
  plan: TrustedSpanQueryPlan,
  selected: SpanQuerySelectedRow[],
  payloads: SpanQueryPayload[],
  // Older adapters pass metrics as a fourth argument. Keep the call shape, without returning costs.
  _metrics?: SpanQueryCostMetric[],
): SpanQueryResponse {
  const byIdentity = new Map(payloads.map(payload => [spanQueryIdentityKey(payload), payload]));
  const visible = selected.slice(0, plan.limit);
  const last = visible.at(-1);
  return spanQueryResponseSchema.parse({
    spans: visible.map(row => {
      const key = spanQueryIdentityKey(row);
      const payload = byIdentity.get(key);
      const input = createSpanQueryPreview(payload?.inputPreview ?? null);
      const output = createSpanQueryPreview(payload?.outputPreview ?? null);
      const error = createSpanQueryPreview(payload?.errorPreview ?? null);
      return {
        ...row,
        inputPreview: input.value,
        outputPreview: output.value,
        errorPreview: error.value,
      };
    }),
    page: {
      next:
        selected.length > plan.limit && last
          ? encodeSpanQueryCursor(plan, {
              organizationId: last.organizationId,
              resourceId: last.resourceId,
              traceId: last.traceId,
              spanId: last.spanId,
              sortValue: last[plan.orderBy.field] ?? null,
            })
          : null,
    },
  });
}
