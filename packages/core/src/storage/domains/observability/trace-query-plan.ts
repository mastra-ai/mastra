// Planning binds queries and cursors with node:crypto and Buffer, so it lives apart from the
// trace-query schemas, which browser entries such as @mastra/core/storage/dashboards load.
import { createHash } from 'node:crypto';
import { z } from 'zod/v4';
import { defaultDeltaLimit } from '../shared';
import {
  compareTraceQueryStrings,
  isTraceQuerySortValueFor,
  normalizeTraceQueryTenantScope,
  planPredicate,
  planThreadPredicate,
  TraceQueryCursorError,
  traceQuerySortValueSchema,
  TraceQueryValidationError,
} from './trace-query';
import type {
  NormalizedQueryThreadsInput,
  NormalizedTraceQueryRequest,
  PlannerState,
  TraceQueryCursorPlan,
  TraceQueryCursorValues,
  TraceQueryIssue,
  TraceQueryPlanOptions,
  TrustedThreadQueryPlan,
  TrustedTraceQueryDeltaTracesPlan,
  TrustedTraceQueryPaginatedTracesPlan,
  TrustedTraceQueryPlan,
} from './trace-query';

/**
 * Converts a structurally valid trace-query request into the canonical plan consumed by
 * observability storage adapters.
 *
 * @internal This is a trusted server/storage boundary, not a client-side query builder.
 */
export function planTraceQuery(
  request: NormalizedTraceQueryRequest,
  options: TraceQueryPlanOptions = {},
): TrustedTraceQueryPlan {
  const issues: TraceQueryIssue[] = [];
  const from = new Date(request.timeRange.from);
  const to = new Date(request.timeRange.to);
  if (from >= to) {
    issues.push({ code: 'invalid_time_range', path: ['timeRange'], message: '`from` must be earlier than `to`' });
  }

  if (request.group && request.orderBy) {
    issues.push({
      code: 'group_order_not_supported',
      path: ['orderBy'],
      message: 'Grouped trace queries use fixed threadId ordering',
    });
  }
  const state: PlannerState = { nodes: 0, relatedClauses: 0, literalUnits: 0, issues };
  const where = request.where ? planPredicate(request.where, 'trace', ['where'], 1, state) : undefined;
  if (issues.length > 0) throw new TraceQueryValidationError(issues);

  const timeRange = { from: from.toISOString(), to: to.toISOString() };
  const scope = normalizeTraceQueryTenantScope(options.scope);

  if (request.group) {
    const result = 'groups' as const;
    const orderBy = { field: 'threadId', direction: 'asc' } as const;
    const binding = digestBinding({
      timeRange,
      where,
      result,
      orderBy,
      authorization: options.authorizationBinding,
      scope,
    });
    const page = request.page ?? { limit: 100 };
    const cursor = page.after ? decodeTraceQueryCursor(page.after, result, binding) : undefined;
    return {
      result,
      timeRange,
      where,
      scope,
      orderBy,
      paginationMode: 'keyset',
      limit: page.limit,
      binding,
      cursor: cursor?.result === 'groups' ? { threadId: cursor.threadId } : undefined,
    };
  }

  const result = 'traces' as const;
  const orderBy = request.orderBy?.[0] ?? ({ field: 'startedAt', direction: 'desc' } as const);
  const deltaBinding = digestBinding({
    timeRange,
    where,
    result: 'trace-delta',
    authorization: options.authorizationBinding,
    scope,
  });
  if (request.mode === 'delta') {
    return {
      result,
      timeRange,
      where,
      scope,
      orderBy,
      paginationMode: 'delta',
      limit: request.limit ?? defaultDeltaLimit,
      binding: deltaBinding,
      deltaCursor: request.after === undefined ? undefined : decodeTraceQueryDeltaCursor(request.after, deltaBinding),
    };
  }
  if (request.pagination) {
    return {
      result,
      timeRange,
      where,
      scope,
      orderBy,
      paginationMode: 'page',
      page: request.pagination.page,
      perPage: request.pagination.perPage,
      deltaBinding,
    };
  }

  const page = request.page ?? { limit: 100 };
  const binding = digestBinding({
    timeRange,
    where,
    result,
    orderBy,
    authorization: options.authorizationBinding,
    scope,
  });
  const cursor = page.after ? decodeTraceQueryCursor(page.after, result, binding) : undefined;
  if (cursor?.result === 'traces' && !isTraceQuerySortValueFor(orderBy.field, cursor.sortValue)) {
    throw new TraceQueryCursorError('TRACE_QUERY_CURSOR_MALFORMED');
  }
  return {
    result,
    timeRange,
    where,
    scope,
    orderBy,
    paginationMode: 'keyset',
    limit: page.limit,
    binding,
    cursor: cursor?.result === 'traces' ? { sortValue: cursor.sortValue, traceId: cursor.traceId } : undefined,
  };
}

/**
 * Converts a structurally valid thread-query request into the canonical plan consumed by
 * observability storage adapters.
 *
 * @internal This is a trusted server/storage boundary, not a client-side query builder.
 */
export function planThreadQuery(
  request: NormalizedQueryThreadsInput,
  options: TraceQueryPlanOptions = {},
): TrustedThreadQueryPlan {
  const issues: TraceQueryIssue[] = [];
  const from = new Date(request.traces.timeRange.from);
  const to = new Date(request.traces.timeRange.to);
  if (from >= to) {
    issues.push({
      code: 'invalid_time_range',
      path: ['traces', 'timeRange'],
      message: '`from` must be earlier than `to`',
    });
  }

  const state: PlannerState = { nodes: 0, relatedClauses: 0, literalUnits: 0, issues };
  const traceWhere = request.traces.where
    ? planPredicate(request.traces.where, 'trace', ['traces', 'where'], 1, state)
    : undefined;
  const where = request.where ? planThreadPredicate(request.where, ['where'], 1, state) : undefined;
  if (issues.length > 0) throw new TraceQueryValidationError(issues);

  const result = 'threads' as const;
  const traces = {
    timeRange: { from: from.toISOString(), to: to.toISOString() },
    where: traceWhere,
  };
  const orderBy = { field: 'threadId', direction: 'asc' } as const;
  const scope = normalizeTraceQueryTenantScope(options.scope);
  const binding = digestBinding({ traces, where, result, orderBy, authorization: options.authorizationBinding, scope });
  const cursor = request.page.after ? decodeTraceQueryCursor(request.page.after, result, binding) : undefined;

  return {
    result,
    traces,
    where,
    scope,
    orderBy,
    limit: request.page.limit,
    binding,
    cursor: cursor?.result === 'threads' ? { threadId: cursor.threadId } : undefined,
  };
}

export function encodeTraceQueryCursor(plan: TraceQueryCursorPlan, values: TraceQueryCursorValues): string {
  if (values.result !== plan.result) throw new TraceQueryCursorError('TRACE_QUERY_CURSOR_CONFLICT');
  return Buffer.from(JSON.stringify({ version: 1, binding: plan.binding, values }), 'utf8').toString('base64url');
}

const deltaCursorEnvelopeSchema = z
  .object({
    version: z.literal(1),
    kind: z.literal('trace-delta'),
    binding: z.string().length(64),
    adapter: z.string().min(1).max(100),
    watermark: z.string().min(1).max(4096),
  })
  .strict();

/** Wraps a storage-native watermark in a query-bound, delta-only cursor. */
export function encodeTraceQueryDeltaCursor(
  plan: TrustedTraceQueryPaginatedTracesPlan | TrustedTraceQueryDeltaTracesPlan,
  adapter: string,
  watermark: string,
): string {
  const envelope = deltaCursorEnvelopeSchema.parse({
    version: 1,
    kind: 'trace-delta',
    binding: 'deltaBinding' in plan ? plan.deltaBinding : plan.binding,
    adapter,
    watermark,
  });
  return Buffer.from(JSON.stringify(envelope), 'utf8').toString('base64url');
}

function decodeTraceQueryDeltaCursor(cursor: string, binding: string): { adapter: string; watermark: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
  } catch {
    throw new TraceQueryCursorError('TRACE_QUERY_CURSOR_MALFORMED');
  }
  const envelope = deltaCursorEnvelopeSchema.safeParse(parsed);
  if (!envelope.success) throw new TraceQueryCursorError('TRACE_QUERY_CURSOR_MALFORMED');
  if (envelope.data.binding !== binding) throw new TraceQueryCursorError('TRACE_QUERY_CURSOR_CONFLICT');
  return { adapter: envelope.data.adapter, watermark: envelope.data.watermark };
}

/** Storage adapters must check cursor ownership before interpreting the native watermark. */
export function getTraceQueryDeltaWatermark(
  plan: TrustedTraceQueryDeltaTracesPlan,
  adapter: string,
): string | undefined {
  if (plan.deltaCursor && plan.deltaCursor.adapter !== adapter) {
    throw new TraceQueryCursorError('TRACE_QUERY_CURSOR_CONFLICT');
  }
  return plan.deltaCursor?.watermark;
}

function decodeTraceQueryCursor(
  cursor: string,
  expectedResult: TraceQueryCursorValues['result'],
  expectedBinding: string,
): TraceQueryCursorValues {
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
  } catch {
    throw new TraceQueryCursorError('TRACE_QUERY_CURSOR_MALFORMED');
  }

  const envelope = cursorEnvelopeSchema.safeParse(parsed);
  if (!envelope.success) throw new TraceQueryCursorError('TRACE_QUERY_CURSOR_MALFORMED');
  if (envelope.data.binding !== expectedBinding || envelope.data.values.result !== expectedResult) {
    throw new TraceQueryCursorError('TRACE_QUERY_CURSOR_CONFLICT');
  }
  return envelope.data.values;
}

const cursorEnvelopeSchema = z
  .object({
    version: z.literal(1),
    binding: z.string().length(64),
    values: z.discriminatedUnion('result', [
      z
        .object({
          result: z.literal('traces'),
          sortValue: traceQuerySortValueSchema,
          traceId: z.string().min(1),
        })
        .strict(),
      z.object({ result: z.literal('groups'), threadId: z.string().min(1) }).strict(),
      z.object({ result: z.literal('threads'), threadId: z.string().min(1) }).strict(),
    ]),
  })
  .strict();

/** @internal Shared query binding with property-order-independent serialization. */
export function digestBinding(value: unknown): string {
  return createHash('sha256').update(stableStringify(value)).digest('hex');
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value)
      .filter(([, nested]) => nested !== undefined)
      .sort(([left], [right]) => compareTraceQueryStrings(left, right))
      .map(([key, nested]) => `${JSON.stringify(key)}:${stableStringify(nested)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}
