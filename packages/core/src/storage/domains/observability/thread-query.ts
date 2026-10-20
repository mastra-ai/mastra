/** Full-history thread rows. Legacy identity queries remain in trace-query.ts. */
import { z } from 'zod/v4';
import {
  digestBinding,
  findPredicateComplexityIssue,
  formatTraceQuerySchemaIssues,
  normalizeTraceQueryTenantScope,
  planThreadQuerySelectionPredicate,
  TRACE_QUERY_PREDICATE_COMPLEXITY_MESSAGE,
  TraceQueryCursorError,
  TraceQueryValidationError,
  traceQueryScalarPredicateSchema,
  traceQueryTimeRangeSchema,
} from './trace-query';
import type { TraceQueryIssue, TraceQueryPlanOptions, TrustedTraceQueryScalarPredicate } from './trace-query';

export { THREAD_QUERY_FIELD_REGISTRY } from './trace-query';
export type { ThreadQueryField } from './trace-query';

export const THREAD_QUERY_MAX_LIMIT = 1000;
const MAX_CURSOR_BYTES = 8192;
const timestamp = z.string().datetime({ offset: true });
const identifier = z.string().min(1).max(512);
const range = traceQueryTimeRangeSchema.refine(value => Date.parse(value.from) < Date.parse(value.to), {
  message: 'The time range must be positive',
});
const requestSchema = z
  .object({
    timeRange: z.union([
      z.object({ traces: range }).strict(),
      z
        .object({
          threads: traceQueryTimeRangeSchema
            .extend({ field: z.enum(['startedAt', 'endedAt']) })
            .refine(value => Date.parse(value.from) < Date.parse(value.to), {
              message: 'The time range must be positive',
            }),
        })
        .strict(),
    ]),
    where: traceQueryScalarPredicateSchema.optional(),
    orderBy: z
      .array(z.object({ field: z.enum(['startedAt', 'endedAt']), direction: z.enum(['asc', 'desc']) }).strict())
      .length(1)
      .default([{ field: 'endedAt', direction: 'desc' }]),
    page: z
      .object({
        limit: z.number().int().min(1).max(THREAD_QUERY_MAX_LIMIT).default(100),
        after: z.string().min(1).max(MAX_CURSOR_BYTES).optional(),
      })
      .strict()
      .default({ limit: 100 }),
  })
  .strict();

export const threadQueryRequestSchema = z.preprocess((input, context) => {
  const path = findPredicateComplexityIssue(input, [['where']]);
  if (path) {
    context.addIssue({ code: 'custom', path, message: TRACE_QUERY_PREDICATE_COMPLEXITY_MESSAGE });
    return z.NEVER;
  }
  return input;
}, requestSchema);

export const threadQueryIdentitySchema = z
  .object({
    organizationId: identifier.nullable(),
    threadId: identifier,
  })
  .strict();

export const threadQueryRowSchema = threadQueryIdentitySchema
  .extend({
    firstTraceId: identifier,
    lastTraceId: identifier,
    resourceId: z.string().nullable(),
    userId: z.string().nullable(),
    entityType: z.string().nullable(),
    entityId: z.string().nullable(),
    entityName: z.string().nullable(),
    entityVersionId: z.string().nullable(),
    runId: z.string().nullable(),
    sessionId: z.string().nullable(),
    requestId: z.string().nullable(),
    serviceName: z.string().nullable(),
    experimentId: z.string().nullable(),
    environment: z.string().nullable(),
    executionSource: z.string().nullable(),
    status: z.enum(['success', 'error']),
    startedAt: timestamp,
    endedAt: timestamp,
    timeToFirstChunkMs: z.number().nonnegative().nullable(),
    inputPreview: z.string().nullable(),
    outputPreview: z.string().nullable(),
    errorPreview: z.string().nullable(),
    traceCount: z.number().int().positive(),
    model: z.string().nullable(),
    provider: z.string().nullable(),
  })
  .strict();

export const threadQueryResponseSchema = z
  .object({
    threads: z.array(threadQueryRowSchema).max(THREAD_QUERY_MAX_LIMIT),
    page: z
      .object({
        next: z
          .string()
          .min(1)
          .max(MAX_CURSOR_BYTES)
          .regex(/^[A-Za-z0-9_-]+$/)
          .nullable(),
      })
      .strict(),
  })
  .strict()
  .superRefine((response, context) => {
    const keys = response.threads.map(row => JSON.stringify([row.organizationId, row.threadId]));
    if (new Set(keys).size !== keys.length)
      context.addIssue({
        code: 'custom',
        path: ['threads'],
        message: 'A page must contain unique scoped thread identities',
      });
  });

export type ThreadQueryRequest = z.input<typeof requestSchema>;
export type NormalizedThreadQueryRequest = z.output<typeof requestSchema>;
export type ThreadQueryRow = z.infer<typeof threadQueryRowSchema>;
export type ThreadQueryResponse = z.infer<typeof threadQueryResponseSchema>;

const cursorValuesSchema = threadQueryIdentitySchema.extend({ sortValue: timestamp }).strict();
const cursorEnvelopeSchema = z
  .object({
    version: z.literal(1),
    result: z.literal('threadRows'),
    binding: z.string().length(64),
    values: cursorValuesSchema,
  })
  .strict();

/**
 * Scope applies to both qualification and population. Group by organizationId/threadId;
 * nullable organization IDs sort last. Other context comes from the first trace.
 * Order by the requested activity timestamp, then organizationId/threadId ascending
 * with bytewise string ordering. First/last traces use (startedAt, traceId).
 */
export interface TrustedThreadRowsQueryPlan {
  result: 'threadRows';
  timeRange: { mode: 'traces' | 'threads'; field: 'startedAt' | 'endedAt'; from: string; to: string };
  where?: TrustedTraceQueryScalarPredicate;
  scope?: TraceQueryPlanOptions['scope'];
  orderBy: NormalizedThreadQueryRequest['orderBy'][number];
  limit: number;
  binding: string;
  cursor?: z.infer<typeof cursorValuesSchema>;
}

export function planThreadRowsQuery(input: unknown, options: TraceQueryPlanOptions = {}): TrustedThreadRowsQueryPlan {
  const parsed = threadQueryRequestSchema.safeParse(input);
  if (!parsed.success) throw new TraceQueryValidationError(formatTraceQuerySchemaIssues(parsed.error));
  const request = parsed.data;
  const issues: TraceQueryIssue[] = [];
  const where = request.where ? planThreadQuerySelectionPredicate(request.where, issues) : undefined;
  if (issues.length) throw new TraceQueryValidationError(issues);
  const scope = normalizeTraceQueryTenantScope(options.scope);
  const selector = request.timeRange;
  const selected = 'traces' in selector ? selector.traces : selector.threads;
  const timeRange: TrustedThreadRowsQueryPlan['timeRange'] = {
    mode: 'traces' in selector ? 'traces' : 'threads',
    field: 'traces' in selector ? 'startedAt' : selector.threads.field,
    from: new Date(selected.from).toISOString(),
    to: new Date(selected.to).toISOString(),
  };
  const orderBy = request.orderBy[0]!;
  const binding = digestBinding({
    version: 1,
    result: 'threadRows',
    timeRange,
    where,
    orderBy,
    scope,
    authorization: options.authorizationBinding,
  });
  let cursor: TrustedThreadRowsQueryPlan['cursor'];
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
    if (envelope.data.binding !== binding || (scope && envelope.data.values.organizationId !== scope.organizationId)) {
      throw new TraceQueryCursorError('TRACE_QUERY_CURSOR_CONFLICT');
    }
    cursor = { ...envelope.data.values, sortValue: new Date(envelope.data.values.sortValue).toISOString() };
  }
  return { result: 'threadRows', timeRange, where, scope, orderBy, limit: request.page.limit, binding, cursor };
}

export function encodeThreadQueryCursor(
  plan: TrustedThreadRowsQueryPlan,
  values: z.infer<typeof cursorValuesSchema>,
): string {
  const envelope = cursorEnvelopeSchema.parse({ version: 1, result: 'threadRows', binding: plan.binding, values });
  const cursor = Buffer.from(JSON.stringify(envelope), 'utf8').toString('base64url');
  if (cursor.length > MAX_CURSOR_BYTES) throw new TraceQueryCursorError('TRACE_QUERY_CURSOR_MALFORMED');
  return cursor;
}
