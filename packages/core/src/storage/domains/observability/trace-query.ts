import { createHash } from 'node:crypto';
import { z } from 'zod/v4';

export const TRACE_QUERY_MAX_DEPTH = 12;
export const TRACE_QUERY_MAX_NODES = 100;
export const TRACE_QUERY_MAX_SET_VALUES = 100;
export const TRACE_QUERY_MAX_RELATED_CLAUSES = 8;
export const TRACE_QUERY_MAX_LITERAL_UNITS = 1000;
export const TRACE_QUERY_MAX_STRING_BYTES = 4096;
export const TRACE_QUERY_MAX_PATH_BYTES = 128;
export const TRACE_QUERY_DEFAULT_TIMEOUT_MS = 15_000;
export const TRACE_QUERY_MAX_TIMEOUT_MS = 300_000;

const PREDICATE_COMPLEXITY_MESSAGE = `Predicates are limited to ${TRACE_QUERY_MAX_NODES} nodes and ${TRACE_QUERY_MAX_DEPTH} levels`;

export function compareTraceQueryStrings(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

const hasMaxUtf8Bytes = (value: string, maxBytes: number) => Buffer.byteLength(value, 'utf8') <= maxBytes;
const literalStringSchema = z
  .string()
  .refine(value => hasMaxUtf8Bytes(value, TRACE_QUERY_MAX_STRING_BYTES), 'String literal is too large');
const timestampLiteralSchema = z.string().datetime({ offset: true });
const predicatePathSchema = z
  .string()
  .min(1)
  .refine(value => hasMaxUtf8Bytes(value, TRACE_QUERY_MAX_PATH_BYTES), 'Predicate path is too large');
const literalSchema = z.union([literalStringSchema, z.number(), z.boolean(), z.null()]);
const pathRefSchema = z.object({ path: predicatePathSchema }).strict();
const literalRefSchema = z.object({ literal: literalSchema }).strict();
const pathOrLiteralSchema = z.union([pathRefSchema, literalRefSchema]);

export const traceQueryScalarPredicateSchema: z.ZodType<TraceQueryScalarPredicate> = z.lazy(() =>
  z.union([
    z
      .object({
        op: z.enum(['eq', 'ne', 'lt', 'lte', 'gt', 'gte']),
        left: pathOrLiteralSchema,
        right: pathOrLiteralSchema,
      })
      .strict(),
    z
      .object({
        op: z.enum(['in', 'notIn']),
        value: pathOrLiteralSchema,
        set: z.array(literalSchema).min(1).max(TRACE_QUERY_MAX_SET_VALUES),
      })
      .strict(),
    z.object({ op: z.enum(['exists', 'notExists']), path: predicatePathSchema }).strict(),
    z
      .object({
        op: z.enum(['and', 'or']),
        args: z.array(traceQueryScalarPredicateSchema).min(1),
      })
      .strict(),
    z.object({ op: z.literal('not'), arg: traceQueryScalarPredicateSchema }).strict(),
  ]),
);

export const traceQueryPredicateSchema: z.ZodType<TraceQueryPredicate> = z.lazy(() =>
  z.union([
    z
      .object({
        op: z.enum(['eq', 'ne', 'lt', 'lte', 'gt', 'gte']),
        left: pathOrLiteralSchema,
        right: pathOrLiteralSchema,
      })
      .strict(),
    z
      .object({
        op: z.enum(['in', 'notIn']),
        value: pathOrLiteralSchema,
        set: z.array(literalSchema).min(1).max(TRACE_QUERY_MAX_SET_VALUES),
      })
      .strict(),
    z.object({ op: z.enum(['exists', 'notExists']), path: predicatePathSchema }).strict(),
    z
      .object({
        op: z.enum(['and', 'or']),
        args: z.array(traceQueryPredicateSchema).min(1),
      })
      .strict(),
    z.object({ op: z.literal('not'), arg: traceQueryPredicateSchema }).strict(),
    z
      .object({
        spans: z.union([
          z.object({ some: traceQueryScalarPredicateSchema }).strict(),
          z.object({ none: traceQueryScalarPredicateSchema }).strict(),
        ]),
      })
      .strict(),
    z
      .object({
        scores: z.union([
          z.object({ some: traceQueryScalarPredicateSchema }).strict(),
          z.object({ none: traceQueryScalarPredicateSchema }).strict(),
        ]),
      })
      .strict(),
  ]),
);

const timeRangeSchema = z
  .object({
    from: z.string().datetime({ offset: true }),
    to: z.string().datetime({ offset: true }),
  })
  .strict();

const pageSchema = z
  .object({
    limit: z.number().int().min(1).max(1000).default(100),
    after: z.string().min(1).nullable().optional(),
  })
  .strict()
  .default({ limit: 100 });

const traceQueryRequestObjectSchema = z
  .object({
    timeRange: timeRangeSchema,
    where: traceQueryPredicateSchema.optional(),
    group: z
      .object({ by: z.tuple([z.literal('threadId')]) })
      .strict()
      .optional(),
    orderBy: z
      .array(
        z
          .object({
            field: z.enum(['startedAt', 'endedAt']),
            direction: z.enum(['asc', 'desc']),
          })
          .strict(),
      )
      .length(1)
      .optional(),
    page: pageSchema,
  })
  .strict();

export const traceQueryRequestSchema = z.preprocess((input, context) => {
  const issuePath = findPredicateComplexityIssue(input);
  if (issuePath) {
    context.addIssue({ code: 'custom', path: issuePath, message: PREDICATE_COMPLEXITY_MESSAGE });
    return z.NEVER;
  }
  return input;
}, traceQueryRequestObjectSchema);

export const traceQueryTraceSchema = z
  .object({
    traceId: z.string(),
    rootSpanId: z.string(),
    threadId: z.string().nullable(),
    resourceId: z.string().nullable(),
    startedAt: z.string().datetime({ offset: true }),
    endedAt: z.string().datetime({ offset: true }),
    entityName: z.string().nullable(),
    entityType: z.string().nullable(),
    environment: z.string().nullable(),
    status: z.enum(['success', 'error']),
  })
  .strict();

const responsePageSchema = z.object({ next: z.string().nullable() }).strict();

export const traceQueryTraceResponseSchema = z
  .object({ traces: z.array(traceQueryTraceSchema), page: responsePageSchema })
  .strict();
export const traceQueryGroupResponseSchema = z
  .object({
    groups: z.array(z.object({ threadId: z.string() }).strict()),
    page: responsePageSchema,
  })
  .strict();
export const traceQueryResponseSchema = z.union([traceQueryTraceResponseSchema, traceQueryGroupResponseSchema]);

export type TraceQueryLiteral = string | number | boolean | null;
export type TraceQueryPathOrLiteral = { path: string } | { literal: TraceQueryLiteral };
export type TraceQueryScalarPredicate =
  | {
      op: 'eq' | 'ne' | 'lt' | 'lte' | 'gt' | 'gte';
      left: TraceQueryPathOrLiteral;
      right: TraceQueryPathOrLiteral;
    }
  | { op: 'in' | 'notIn'; value: TraceQueryPathOrLiteral; set: TraceQueryLiteral[] }
  | { op: 'exists' | 'notExists'; path: string }
  | { op: 'and' | 'or'; args: TraceQueryScalarPredicate[] }
  | { op: 'not'; arg: TraceQueryScalarPredicate };

export type TraceQueryPredicate =
  | Exclude<TraceQueryScalarPredicate, { op: 'and' | 'or' } | { op: 'not' }>
  | { op: 'and' | 'or'; args: TraceQueryPredicate[] }
  | { op: 'not'; arg: TraceQueryPredicate }
  | { spans: { some: TraceQueryScalarPredicate } | { none: TraceQueryScalarPredicate } }
  | { scores: { some: TraceQueryScalarPredicate } | { none: TraceQueryScalarPredicate } };

export type TraceQueryRequest = z.input<typeof traceQueryRequestObjectSchema>;
export type NormalizedTraceQueryRequest = z.output<typeof traceQueryRequestObjectSchema>;
export type TraceQueryTrace = z.infer<typeof traceQueryTraceSchema>;
export type TraceQueryTraceResponse = z.infer<typeof traceQueryTraceResponseSchema>;
export type TraceQueryGroupResponse = z.infer<typeof traceQueryGroupResponseSchema>;
export type TraceQueryResponse = z.infer<typeof traceQueryResponseSchema>;

export type TraceQueryField =
  | 'traceId'
  | 'threadId'
  | 'resourceId'
  | 'startedAt'
  | 'endedAt'
  | 'entityName'
  | 'entityType'
  | 'environment'
  | 'status';
export type TraceQuerySpanField =
  | 'name'
  | 'spanType'
  | 'model'
  | 'provider'
  | 'startedAt'
  | 'endedAt'
  | 'durationMs'
  | 'status'
  | 'error'
  | 'entityType'
  | 'entityId'
  | 'entityName'
  | 'entityVersionId'
  | 'parentEntityVersionId'
  | 'rootEntityVersionId';
export type TraceQueryScoreField =
  | 'scorerId'
  | 'scorerVersion'
  | 'scoreSource'
  | 'score'
  | 'timestamp'
  | 'spanId'
  | 'entityVersionId'
  | 'parentEntityVersionId'
  | 'rootEntityVersionId';
export type TraceQueryCanonicalField = TraceQueryField | TraceQuerySpanField | TraceQueryScoreField;
export type TraceQueryMetadataField = `metadata.${string}`;
export type TraceQueryPredicateField = TraceQueryCanonicalField | TraceQueryMetadataField;
export type TraceQueryComparisonOperator = 'eq' | 'ne' | 'lt' | 'lte' | 'gt' | 'gte';
export type TraceQueryMembershipOperator = 'in' | 'notIn';
export type TraceQueryPresenceOperator = 'exists' | 'notExists';

export type TrustedTraceQueryScalarPredicate =
  | {
      type: 'comparison';
      field: TraceQueryPredicateField;
      operator: TraceQueryComparisonOperator;
      value: string | number;
    }
  | {
      type: 'membership';
      field: TraceQueryPredicateField;
      operator: TraceQueryMembershipOperator;
      values: Array<string | number>;
    }
  | { type: 'presence'; field: TraceQueryPredicateField; operator: TraceQueryPresenceOperator }
  | { type: 'boolean'; operator: 'and' | 'or'; args: TrustedTraceQueryScalarPredicate[] }
  | { type: 'not'; arg: TrustedTraceQueryScalarPredicate };

export type TrustedTraceQueryPredicate =
  | TrustedTraceQueryScalarPredicate
  | { type: 'boolean'; operator: 'and' | 'or'; args: TrustedTraceQueryPredicate[] }
  | { type: 'not'; arg: TrustedTraceQueryPredicate }
  | {
      type: 'relation';
      collection: 'spans' | 'scores';
      quantifier: 'some' | 'none';
      predicate: TrustedTraceQueryScalarPredicate;
    };

export interface TrustedTraceQueryBasePlan {
  timeRange: { from: string; to: string };
  where?: TrustedTraceQueryPredicate;
  limit: number;
  binding: string;
}

export interface TrustedTraceQueryTracesPlan extends TrustedTraceQueryBasePlan {
  result: 'traces';
  orderBy: {
    field: 'startedAt' | 'endedAt';
    direction: 'asc' | 'desc';
  };
  cursor?: { sortValue: string; traceId: string };
}

export interface TrustedTraceQueryGroupsPlan extends TrustedTraceQueryBasePlan {
  result: 'groups';
  orderBy: { field: 'threadId'; direction: 'asc' };
  cursor?: { threadId: string };
}

export type TrustedTraceQueryPlan = TrustedTraceQueryTracesPlan | TrustedTraceQueryGroupsPlan;
export type TraceQueryCursorValues =
  | { result: 'traces'; sortValue: string; traceId: string }
  | { result: 'groups'; threadId: string };

export type TraceQueryIssueCode =
  | 'invalid_request'
  | 'invalid_time_range'
  | 'time_range_too_large'
  | 'predicate_too_complex'
  | 'field_not_allowed'
  | 'invalid_metadata_key'
  | 'operator_not_allowed'
  | 'invalid_operands'
  | 'invalid_literal'
  | 'group_order_not_supported';

export interface TraceQueryIssue {
  code: TraceQueryIssueCode;
  path: Array<string | number>;
  message: string;
}

export class TraceQueryValidationError extends Error {
  readonly code = 'TRACE_QUERY_INVALID';

  constructor(readonly issues: TraceQueryIssue[]) {
    super('The trace query is invalid');
    this.name = 'TraceQueryValidationError';
  }
}

export class TraceQueryCursorError extends Error {
  constructor(readonly code: 'TRACE_QUERY_CURSOR_MALFORMED' | 'TRACE_QUERY_CURSOR_CONFLICT') {
    super(
      code === 'TRACE_QUERY_CURSOR_MALFORMED'
        ? 'The trace query cursor is malformed'
        : 'The cursor does not match the query',
    );
    this.name = 'TraceQueryCursorError';
  }
}

export class TraceQueryExecutionError extends Error {
  readonly code = 'TRACE_QUERY_EXECUTION_TIMEOUT';

  constructor() {
    super('The trace query exceeded its execution timeout');
    this.name = 'TraceQueryExecutionError';
  }
}

export function resolveTraceQueryTimeoutMs(timeoutMs = TRACE_QUERY_DEFAULT_TIMEOUT_MS): number {
  if (
    !Number.isFinite(timeoutMs) ||
    !Number.isInteger(timeoutMs) ||
    timeoutMs <= 0 ||
    timeoutMs > TRACE_QUERY_MAX_TIMEOUT_MS
  ) {
    throw new RangeError(`traceQueryTimeoutMs must be an integer between 1 and ${TRACE_QUERY_MAX_TIMEOUT_MS}`);
  }
  return timeoutMs;
}

interface FieldRule {
  type: 'string' | 'number' | 'timestamp' | 'presence';
  operators: ReadonlySet<string>;
  nonEmpty?: boolean;
}

const STRING_OPERATORS = new Set(['eq', 'ne', 'in', 'notIn', 'exists', 'notExists']);
const ORDERED_OPERATORS = new Set([...STRING_OPERATORS, 'lt', 'lte', 'gt', 'gte']);
const PRESENCE_OPERATORS = new Set(['exists', 'notExists']);
const METADATA_FIELD_RULE: FieldRule = { type: 'string', operators: STRING_OPERATORS, nonEmpty: true };

const PROMOTED_METADATA_KEYS = new Set([
  'experimentId',
  'entityType',
  'entityId',
  'entityName',
  'entityVersionId',
  'parentEntityVersionId',
  'rootEntityVersionId',
  'userId',
  'organizationId',
  'resourceId',
  'runId',
  'sessionId',
  'threadId',
  'requestId',
  'environment',
  'executionSource',
  'serviceName',
]);
const SENSITIVE_METADATA_KEYS = new Set([
  'password',
  'token',
  'secret',
  'key',
  'apikey',
  'auth',
  'authorization',
  'bearer',
  'bearertoken',
  'jwt',
  'credential',
  'clientsecret',
  'privatekey',
  'refresh',
  'ssn',
]);

const TRACE_FIELD_RULES: Record<TraceQueryField, FieldRule> = {
  traceId: { type: 'string', operators: STRING_OPERATORS },
  threadId: { type: 'string', operators: STRING_OPERATORS },
  resourceId: { type: 'string', operators: STRING_OPERATORS },
  startedAt: { type: 'timestamp', operators: ORDERED_OPERATORS },
  endedAt: { type: 'timestamp', operators: ORDERED_OPERATORS },
  entityName: { type: 'string', operators: STRING_OPERATORS },
  entityType: { type: 'string', operators: STRING_OPERATORS },
  environment: { type: 'string', operators: STRING_OPERATORS },
  status: { type: 'string', operators: STRING_OPERATORS },
};

const SPAN_FIELD_RULES: Record<TraceQuerySpanField, FieldRule> = {
  name: { type: 'string', operators: STRING_OPERATORS },
  spanType: { type: 'string', operators: STRING_OPERATORS },
  model: { type: 'string', operators: STRING_OPERATORS },
  provider: { type: 'string', operators: STRING_OPERATORS },
  startedAt: { type: 'timestamp', operators: ORDERED_OPERATORS },
  endedAt: { type: 'timestamp', operators: ORDERED_OPERATORS },
  durationMs: { type: 'number', operators: ORDERED_OPERATORS },
  status: { type: 'string', operators: STRING_OPERATORS },
  error: { type: 'presence', operators: PRESENCE_OPERATORS },
  entityType: { type: 'string', operators: STRING_OPERATORS },
  entityId: { type: 'string', operators: STRING_OPERATORS },
  entityName: { type: 'string', operators: STRING_OPERATORS },
  entityVersionId: { type: 'string', operators: STRING_OPERATORS },
  parentEntityVersionId: { type: 'string', operators: STRING_OPERATORS },
  rootEntityVersionId: { type: 'string', operators: STRING_OPERATORS },
};

const SCORE_FIELD_RULES: Record<TraceQueryScoreField, FieldRule> = {
  scorerId: { type: 'string', operators: STRING_OPERATORS },
  scorerVersion: { type: 'string', operators: STRING_OPERATORS },
  scoreSource: { type: 'string', operators: STRING_OPERATORS },
  score: { type: 'number', operators: ORDERED_OPERATORS },
  timestamp: { type: 'timestamp', operators: ORDERED_OPERATORS },
  spanId: { type: 'presence', operators: PRESENCE_OPERATORS },
  entityVersionId: { type: 'string', operators: STRING_OPERATORS },
  parentEntityVersionId: { type: 'string', operators: STRING_OPERATORS },
  rootEntityVersionId: { type: 'string', operators: STRING_OPERATORS },
};

type PredicateContext = 'trace' | 'spans' | 'scores';

interface PlannerState {
  nodes: number;
  relatedClauses: number;
  literalUnits: number;
  issues: TraceQueryIssue[];
}

function addPredicateComplexityIssue(path: Array<string | number>, message: string, state: PlannerState): void {
  if (!state.issues.some(issue => issue.code === 'predicate_too_complex' && issue.message === message)) {
    state.issues.push({ code: 'predicate_too_complex', path, message });
  }
}

function findPredicateComplexityIssue(input: unknown): Array<string | number> | undefined {
  if (!input || typeof input !== 'object' || !Object.hasOwn(input, 'where')) return undefined;

  const where = (input as { where?: unknown }).where;
  if (where === undefined) return undefined;

  const stack: Array<{ predicate: unknown; path: Array<string | number>; depth: number }> = [
    { predicate: where, path: ['where'], depth: 1 },
  ];
  let nodes = 0;

  while (stack.length > 0) {
    const frame = stack.pop()!;
    nodes += 1;
    if (frame.depth > TRACE_QUERY_MAX_DEPTH || nodes > TRACE_QUERY_MAX_NODES) return frame.path;
    if (!frame.predicate || typeof frame.predicate !== 'object') continue;

    const predicate = frame.predicate as Record<string, unknown>;
    if ((predicate.op === 'and' || predicate.op === 'or') && Array.isArray(predicate.args)) {
      for (let index = predicate.args.length - 1; index >= 0; index -= 1) {
        stack.push({ predicate: predicate.args[index], path: [...frame.path, 'args', index], depth: frame.depth + 1 });
      }
      continue;
    }
    if (predicate.op === 'not' && Object.hasOwn(predicate, 'arg')) {
      stack.push({ predicate: predicate.arg, path: [...frame.path, 'arg'], depth: frame.depth + 1 });
      continue;
    }

    for (const collection of ['scores', 'spans'] as const) {
      const clause = predicate[collection];
      if (!clause || typeof clause !== 'object') continue;
      for (const quantifier of ['none', 'some'] as const) {
        if (!Object.hasOwn(clause, quantifier)) continue;
        stack.push({
          predicate: (clause as Record<string, unknown>)[quantifier],
          path: [...frame.path, collection, quantifier],
          depth: frame.depth + 1,
        });
      }
    }
  }

  return undefined;
}

export function formatTraceQuerySchemaIssues(error: z.ZodError): TraceQueryIssue[] {
  return error.issues.map(issue => {
    const predicateTooComplex = issue.code === 'custom' && issue.message === PREDICATE_COMPLEXITY_MESSAGE;
    return {
      code: predicateTooComplex ? 'predicate_too_complex' : 'invalid_request',
      path: issue.path.map(part => (typeof part === 'symbol' ? String(part) : part)),
      message: predicateTooComplex
        ? PREDICATE_COMPLEXITY_MESSAGE
        : 'The value does not match the trace-query request contract',
    };
  });
}

export function parseTraceQueryRequest(input: unknown): NormalizedTraceQueryRequest {
  const result = traceQueryRequestSchema.safeParse(input);
  if (!result.success) throw new TraceQueryValidationError(formatTraceQuerySchemaIssues(result.error));
  return result.data;
}

/**
 * Converts a structurally valid trace-query request into the canonical plan consumed by
 * observability storage adapters.
 *
 * @internal This is a trusted server/storage boundary, not a client-side query builder.
 */
export function planTraceQuery(
  request: NormalizedTraceQueryRequest,
  options: { authorizationBinding?: string } = {},
): TrustedTraceQueryPlan {
  const issues: TraceQueryIssue[] = [];
  const from = new Date(request.timeRange.from);
  const to = new Date(request.timeRange.to);
  if (from >= to) {
    issues.push({ code: 'invalid_time_range', path: ['timeRange'], message: '`from` must be earlier than `to`' });
  } else if (to.getTime() - from.getTime() > 31 * 24 * 60 * 60 * 1000) {
    issues.push({
      code: 'time_range_too_large',
      path: ['timeRange'],
      message: 'The time range cannot exceed 31 days',
    });
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
  const limit = request.page.limit;

  if (request.group) {
    const result = 'groups' as const;
    const orderBy = { field: 'threadId', direction: 'asc' } as const;
    const binding = digestBinding({ timeRange, where, result, orderBy, authorization: options.authorizationBinding });
    const cursor = request.page.after ? decodeTraceQueryCursor(request.page.after, result, binding) : undefined;
    return {
      result,
      timeRange,
      where,
      orderBy,
      limit,
      binding,
      cursor: cursor?.result === 'groups' ? { threadId: cursor.threadId } : undefined,
    };
  }

  const result = 'traces' as const;
  const orderBy = request.orderBy?.[0] ?? ({ field: 'startedAt', direction: 'desc' } as const);
  const binding = digestBinding({ timeRange, where, result, orderBy, authorization: options.authorizationBinding });
  const cursor = request.page.after ? decodeTraceQueryCursor(request.page.after, result, binding) : undefined;
  return {
    result,
    timeRange,
    where,
    orderBy,
    limit,
    binding,
    cursor: cursor?.result === 'traces' ? { sortValue: cursor.sortValue, traceId: cursor.traceId } : undefined,
  };
}

export function encodeTraceQueryCursor(plan: TrustedTraceQueryPlan, values: TraceQueryCursorValues): string {
  if (values.result !== plan.result) throw new TraceQueryCursorError('TRACE_QUERY_CURSOR_CONFLICT');
  return Buffer.from(JSON.stringify({ version: 1, binding: plan.binding, values }), 'utf8').toString('base64url');
}

function decodeTraceQueryCursor(
  cursor: string,
  expectedResult: 'traces' | 'groups',
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
          sortValue: z.string().datetime({ offset: true }),
          traceId: z.string().min(1),
        })
        .strict(),
      z.object({ result: z.literal('groups'), threadId: z.string().min(1) }).strict(),
    ]),
  })
  .strict();

function planPredicate(
  predicate: TraceQueryPredicate | TraceQueryScalarPredicate,
  context: PredicateContext,
  path: Array<string | number>,
  depth: number,
  state: PlannerState,
): TrustedTraceQueryPredicate | TrustedTraceQueryScalarPredicate | undefined {
  state.nodes += 1;
  if (depth > TRACE_QUERY_MAX_DEPTH || state.nodes > TRACE_QUERY_MAX_NODES) {
    addPredicateComplexityIssue(path, PREDICATE_COMPLEXITY_MESSAGE, state);
    return undefined;
  }

  if ('spans' in predicate || 'scores' in predicate) {
    state.relatedClauses += 1;
    if (state.relatedClauses > TRACE_QUERY_MAX_RELATED_CLAUSES) {
      addPredicateComplexityIssue(
        path,
        `Trace queries are limited to ${TRACE_QUERY_MAX_RELATED_CLAUSES} related collection clauses`,
        state,
      );
    }
    if (context !== 'trace') {
      state.issues.push({
        code: 'invalid_request',
        path,
        message: 'Related collections cannot be nested inside related-record predicates',
      });
      return undefined;
    }
    const collection = 'spans' in predicate ? 'spans' : 'scores';
    const clause = 'spans' in predicate ? predicate.spans : predicate.scores;
    const quantifier = 'some' in clause ? 'some' : 'none';
    const nested = 'some' in clause ? clause.some : clause.none;
    const planned = planPredicate(nested, collection, [...path, collection, quantifier], depth + 1, state);
    return planned
      ? { type: 'relation', collection, quantifier, predicate: planned as TrustedTraceQueryScalarPredicate }
      : undefined;
  }

  if (predicate.op === 'and' || predicate.op === 'or') {
    const args = predicate.args
      .map((arg, index) => planPredicate(arg, context, [...path, 'args', index], depth + 1, state))
      .filter((arg): arg is TrustedTraceQueryPredicate => arg !== undefined);
    return { type: 'boolean', operator: predicate.op, args };
  }
  if (predicate.op === 'not') {
    const arg = planPredicate(predicate.arg, context, [...path, 'arg'], depth + 1, state);
    return arg ? { type: 'not', arg } : undefined;
  }

  const rules = rulesForContext(context);
  if (predicate.op === 'exists' || predicate.op === 'notExists') {
    const field = normalizePath(predicate.path);
    const rule = getRule(field, context, rules, [...path, 'path'], state);
    if (!rule) return undefined;
    if (!rule.operators.has(predicate.op)) addOperatorIssue(predicate.op, field, [...path, 'op'], state);
    return { type: 'presence', field: field as TraceQueryPredicateField, operator: predicate.op };
  }

  if (predicate.op === 'in' || predicate.op === 'notIn') {
    state.literalUnits += predicate.set.length;
    if (state.literalUnits > TRACE_QUERY_MAX_LITERAL_UNITS) {
      addPredicateComplexityIssue(
        [...path, 'set'],
        `Trace queries are limited to ${TRACE_QUERY_MAX_LITERAL_UNITS} literal units`,
        state,
      );
    }
    if (!('path' in predicate.value)) {
      state.issues.push({
        code: 'invalid_operands',
        path: [...path, 'value'],
        message: 'Membership predicates require an allowlisted field path',
      });
      return undefined;
    }
    const field = normalizePath(predicate.value.path);
    const rule = getRule(field, context, rules, [...path, 'value', 'path'], state);
    if (!rule) return undefined;
    if (!rule.operators.has(predicate.op)) addOperatorIssue(predicate.op, field, [...path, 'op'], state);
    const values = normalizeSet(predicate.set, rule);
    if (!values) {
      state.issues.push({
        code: 'invalid_literal',
        path: [...path, 'set'],
        message: 'Membership values must be homogeneous and match the selected field type',
      });
      return undefined;
    }
    return {
      type: 'membership',
      field: field as TraceQueryPredicateField,
      operator: predicate.op,
      values,
    };
  }

  const comparison = predicate as Extract<TraceQueryScalarPredicate, { left: TraceQueryPathOrLiteral }>;
  state.literalUnits += 1;
  if (state.literalUnits > TRACE_QUERY_MAX_LITERAL_UNITS) {
    addPredicateComplexityIssue(
      [...path, 'right', 'literal'],
      `Trace queries are limited to ${TRACE_QUERY_MAX_LITERAL_UNITS} literal units`,
      state,
    );
  }
  if (!('path' in comparison.left) || !('literal' in comparison.right)) {
    state.issues.push({
      code: 'invalid_operands',
      path,
      message: 'Comparison predicates require a field on the left and a literal on the right',
    });
    return undefined;
  }
  const field = normalizePath(comparison.left.path);
  const rule = getRule(field, context, rules, [...path, 'left', 'path'], state);
  if (!rule) return undefined;
  if (!rule.operators.has(comparison.op)) addOperatorIssue(comparison.op, field, [...path, 'op'], state);
  const value = normalizeLiteral(comparison.right.literal, rule);
  if (value === undefined) {
    state.issues.push({
      code: 'invalid_literal',
      path: [...path, 'right', 'literal'],
      message: 'The literal does not match the selected field type',
    });
    return undefined;
  }
  return { type: 'comparison', field: field as TraceQueryPredicateField, operator: comparison.op, value };
}

function rulesForContext(context: PredicateContext): Record<string, FieldRule> {
  if (context === 'spans') return SPAN_FIELD_RULES;
  if (context === 'scores') return SCORE_FIELD_RULES;
  return TRACE_FIELD_RULES;
}

function getRule(
  field: string,
  context: PredicateContext,
  rules: Record<string, FieldRule>,
  path: Array<string | number>,
  state: PlannerState,
): FieldRule | undefined {
  if (context === 'trace' && field.startsWith('metadata.')) {
    const key = field.slice('metadata.'.length);
    if (key.length === 0 || key.includes('.')) {
      state.issues.push({
        code: 'invalid_metadata_key',
        path,
        message: 'Metadata predicates require one non-empty top-level key',
      });
      return undefined;
    }
    if (PROMOTED_METADATA_KEYS.has(key) || SENSITIVE_METADATA_KEYS.has(normalizeMetadataKey(key))) {
      state.issues.push({ code: 'field_not_allowed', path, message: 'The predicate field is not allowed here' });
      return undefined;
    }
    return METADATA_FIELD_RULE;
  }
  if (!Object.hasOwn(rules, field)) {
    state.issues.push({ code: 'field_not_allowed', path, message: 'The predicate field is not allowed here' });
    return undefined;
  }
  return rules[field];
}

function normalizeMetadataKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function addOperatorIssue(operator: string, field: string, path: Array<string | number>, state: PlannerState): void {
  state.issues.push({
    code: 'operator_not_allowed',
    path,
    message: `Operator ${operator} is not supported for field ${field}`,
  });
}

function normalizePath(path: string): string {
  const match = /^\$\{([^}]+)\}$/.exec(path.trim());
  return (match?.[1] ?? path).trim();
}

function normalizeLiteral(value: TraceQueryLiteral, rule: FieldRule): string | number | undefined {
  if (rule.type === 'number') return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
  if (rule.type === 'timestamp') {
    const timestamp = timestampLiteralSchema.safeParse(value);
    return timestamp.success ? new Date(timestamp.data).toISOString() : undefined;
  }
  if (rule.type === 'string') {
    return typeof value === 'string' && (!rule.nonEmpty || value.trim().length > 0) ? value : undefined;
  }
  return undefined;
}

function normalizeSet(values: TraceQueryLiteral[], rule: FieldRule): Array<string | number> | undefined {
  const normalized = values.map(value => normalizeLiteral(value, rule));
  return normalized.some(value => value === undefined) ? undefined : (normalized as Array<string | number>);
}

function digestBinding(value: unknown): string {
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
