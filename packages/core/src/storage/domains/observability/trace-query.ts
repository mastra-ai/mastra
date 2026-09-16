import { createHash } from 'node:crypto';
import { z } from 'zod/v4';
import type { SpanRecord } from './tracing';

export const TRACE_QUERY_MAX_DEPTH = 12;
export const TRACE_QUERY_MAX_NODES = 100;
export const TRACE_QUERY_MAX_SET_VALUES = 100;
export const TRACE_QUERY_MAX_RELATED_CLAUSES = 8;
export const TRACE_QUERY_MAX_LITERAL_UNITS = 1000;
export const TRACE_QUERY_MAX_STRING_BYTES = 4096;
export const TRACE_QUERY_MAX_PATH_BYTES = 128;
export const TRACE_QUERY_DISCOVERY_DEFAULT_LIMIT = 25;
export const TRACE_QUERY_DISCOVERY_MAX_LIMIT = 100;
export const TRACE_QUERY_DISCOVERY_MAX_SEARCH_LENGTH = 256;
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
    z
      .object({
        feedback: z.union([
          z.object({ some: traceQueryScalarPredicateSchema }).strict(),
          z.object({ none: traceQueryScalarPredicateSchema }).strict(),
        ]),
      })
      .strict(),
  ]),
);

export const traceQueryTimeRangeSchema = z
  .object({
    from: z.string().datetime({ offset: true }),
    to: z.string().datetime({ offset: true }),
  })
  .strict();

export const traceQueryPredicateScopeSchema = z.enum(['trace', 'spans', 'scores', 'feedback']);
export const traceQueryOperatorSchema = z.enum([
  'eq',
  'ne',
  'lt',
  'lte',
  'gt',
  'gte',
  'in',
  'notIn',
  'exists',
  'notExists',
]);
export const traceQueryValueKindSchema = z.enum(['string', 'number', 'stringOrNumber', 'timestamp', 'presence']);

const traceQueryDiscoveryTimeRangeSchema = traceQueryTimeRangeSchema.superRefine((timeRange, context) => {
  const from = new Date(timeRange.from);
  const to = new Date(timeRange.to);
  if (from >= to) {
    context.addIssue({ code: 'custom', path: [], message: '`from` must be earlier than `to`' });
  } else if (to.getTime() - from.getTime() > 31 * 24 * 60 * 60 * 1000) {
    context.addIssue({ code: 'custom', path: [], message: 'The time range cannot exceed 31 days' });
  }
});
const traceQueryDiscoverySearchSchema = z.string().trim().max(TRACE_QUERY_DISCOVERY_MAX_SEARCH_LENGTH).optional();
const traceQueryDiscoveryLimitSchema = z
  .number()
  .int()
  .min(1)
  .max(TRACE_QUERY_DISCOVERY_MAX_LIMIT)
  .default(TRACE_QUERY_DISCOVERY_DEFAULT_LIMIT);

export const getTraceQueryFieldsArgsSchema = z
  .object({
    timeRange: traceQueryDiscoveryTimeRangeSchema,
    predicateScope: traceQueryPredicateScopeSchema,
    search: traceQueryDiscoverySearchSchema,
    limit: traceQueryDiscoveryLimitSchema,
  })
  .strict();

export const getTraceQueryValuesArgsSchema = z
  .object({
    timeRange: traceQueryDiscoveryTimeRangeSchema,
    predicateScope: traceQueryPredicateScopeSchema,
    path: predicatePathSchema.transform(path => normalizePath(path)),
    search: traceQueryDiscoverySearchSchema,
    limit: traceQueryDiscoveryLimitSchema,
  })
  .strict()
  .superRefine((args, context) => {
    if (!isTraceQueryValueSuggestionsPath(args.predicateScope, args.path)) {
      context.addIssue({
        code: 'custom',
        path: ['path'],
        message: 'Value suggestions are not available for this path',
      });
    }
  });

export const traceQueryCanonicalFieldDescriptorSchema = z
  .object({
    path: z.string(),
    valueKind: traceQueryValueKindSchema,
    operators: z.array(traceQueryOperatorSchema),
    valueSuggestions: z.boolean(),
  })
  .strict();
export const traceQueryObservedFieldDescriptorSchema = z
  .object({
    path: z
      .string()
      .startsWith('metadata.')
      .refine(path => isTraceQueryMetadataPath(path), 'Invalid metadata path'),
    valueKind: z.literal('string'),
    operators: z.array(z.enum(['eq', 'ne', 'in', 'notIn', 'exists', 'notExists'])),
    valueSuggestions: z.literal(true),
    occurrences: z.number().int().nonnegative(),
  })
  .strict();
export const getTraceQueryFieldsResponseSchema = z
  .object({
    canonicalFields: z.array(traceQueryCanonicalFieldDescriptorSchema),
    observedFields: z.array(traceQueryObservedFieldDescriptorSchema).max(TRACE_QUERY_DISCOVERY_MAX_LIMIT),
    observedFieldsTruncated: z.boolean(),
  })
  .strict();
export const getTraceQueryValuesResponseSchema = z
  .object({
    values: z
      .array(z.object({ value: literalStringSchema, count: z.number().int().nonnegative() }).strict())
      .max(TRACE_QUERY_DISCOVERY_MAX_LIMIT),
    valuesTruncated: z.boolean(),
  })
  .strict();

export const traceSelectionSchema = z
  .object({
    timeRange: traceQueryTimeRangeSchema,
    where: traceQueryPredicateSchema.optional(),
  })
  .strict();

export const threadPredicateSchema: z.ZodType<ThreadPredicate> = z.lazy(() =>
  z.union([
    z
      .object({
        op: z.enum(['and', 'or']),
        args: z.array(threadPredicateSchema).min(1),
      })
      .strict(),
    z.object({ op: z.literal('not'), arg: threadPredicateSchema }).strict(),
    z
      .object({
        traces: z.union([
          z.object({ some: traceQueryPredicateSchema }).strict(),
          z.object({ none: traceQueryPredicateSchema }).strict(),
        ]),
      })
      .strict(),
  ]),
);

const pageSchema = z
  .object({
    limit: z.number().int().min(1).max(1000).default(100),
    after: z.string().min(1).nullable().optional(),
  })
  .strict()
  .default({ limit: 100 });

const traceQueryRequestObjectSchema = z
  .object({
    timeRange: traceQueryTimeRangeSchema,
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
  const issuePath = findPredicateComplexityIssue(input, [['where']]);
  if (issuePath) {
    context.addIssue({ code: 'custom', path: issuePath, message: PREDICATE_COMPLEXITY_MESSAGE });
    return z.NEVER;
  }
  return input;
}, traceQueryRequestObjectSchema);

const queryThreadsInputObjectSchema = z
  .object({
    traces: traceSelectionSchema,
    where: threadPredicateSchema.optional(),
    page: pageSchema,
  })
  .strict();

export const queryThreadsInputSchema = z.preprocess((input, context) => {
  const issuePath = findPredicateComplexityIssue(input, [['traces', 'where'], ['where']]);
  if (issuePath) {
    context.addIssue({ code: 'custom', path: issuePath, message: PREDICATE_COMPLEXITY_MESSAGE });
    return z.NEVER;
  }
  return input;
}, queryThreadsInputObjectSchema);

export const traceQueryTraceSchema = z
  .object({
    traceId: z.string(),
    rootSpanId: z.string(),
    name: z.string(),
    entityId: z.string().nullable(),
    parentSpanId: z.string().nullable(),
    createdAt: z.string().datetime({ offset: true }),
    metadata: z.record(z.string(), z.unknown()).nullable(),
    inputPreview: z.string().nullable(),
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

export const threadIdentitySchema = z.object({ threadId: z.string() }).strict();
export const queryThreadsResultSchema = z
  .object({
    threads: z.array(threadIdentitySchema),
    page: responsePageSchema,
  })
  .strict();

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
  | { scores: { some: TraceQueryScalarPredicate } | { none: TraceQueryScalarPredicate } }
  | { feedback: { some: TraceQueryScalarPredicate } | { none: TraceQueryScalarPredicate } };

export type ThreadPredicate =
  | { op: 'and' | 'or'; args: ThreadPredicate[] }
  | { op: 'not'; arg: ThreadPredicate }
  | { traces: { some: TraceQueryPredicate } | { none: TraceQueryPredicate } };

export type TimeRange = z.infer<typeof traceQueryTimeRangeSchema>;
export type TraceSelection = z.input<typeof traceSelectionSchema>;
export type NormalizedTraceSelection = z.output<typeof traceSelectionSchema>;
export type QueryThreadsInput = z.input<typeof queryThreadsInputObjectSchema>;
export type NormalizedQueryThreadsInput = z.output<typeof queryThreadsInputObjectSchema>;
export type ThreadIdentity = z.infer<typeof threadIdentitySchema>;
export type QueryThreadsResult = z.infer<typeof queryThreadsResultSchema>;

export type TraceQueryRequest = z.input<typeof traceQueryRequestObjectSchema>;
export type NormalizedTraceQueryRequest = z.output<typeof traceQueryRequestObjectSchema>;
export type TraceQueryTrace = z.infer<typeof traceQueryTraceSchema>;
export type TraceQueryTraceResponse = z.infer<typeof traceQueryTraceResponseSchema>;
export type TraceQueryGroupResponse = z.infer<typeof traceQueryGroupResponseSchema>;
export type TraceQueryResponse = z.infer<typeof traceQueryResponseSchema>;

export type TraceQueryOperator = z.infer<typeof traceQueryOperatorSchema>;
export type TraceQueryValueKind = z.infer<typeof traceQueryValueKindSchema>;
export type TraceQueryPredicateScope = z.infer<typeof traceQueryPredicateScopeSchema>;

interface FieldRule {
  valueKind: TraceQueryValueKind;
  operators: readonly TraceQueryOperator[];
  valueSuggestions: boolean;
  nonEmpty?: boolean;
}

export const TRACE_QUERY_STRING_OPERATORS = ['eq', 'ne', 'in', 'notIn', 'exists', 'notExists'] as const;
export const TRACE_QUERY_ORDERED_OPERATORS = [...TRACE_QUERY_STRING_OPERATORS, 'lt', 'lte', 'gt', 'gte'] as const;
export const TRACE_QUERY_PRESENCE_OPERATORS = ['exists', 'notExists'] as const;

const stringField = (valueSuggestions: boolean): FieldRule => ({
  valueKind: 'string',
  operators: TRACE_QUERY_STRING_OPERATORS,
  valueSuggestions,
});
const orderedField = (valueKind: 'number' | 'stringOrNumber' | 'timestamp'): FieldRule => ({
  valueKind,
  operators: TRACE_QUERY_ORDERED_OPERATORS,
  valueSuggestions: false,
});
const presenceField = (): FieldRule => ({
  valueKind: 'presence',
  operators: TRACE_QUERY_PRESENCE_OPERATORS,
  valueSuggestions: false,
});

export const TRACE_QUERY_FIELD_REGISTRY = {
  trace: {
    traceId: stringField(false),
    threadId: stringField(false),
    resourceId: stringField(false),
    startedAt: orderedField('timestamp'),
    endedAt: orderedField('timestamp'),
    entityName: stringField(true),
    entityType: stringField(true),
    environment: stringField(true),
    status: stringField(true),
  },
  spans: {
    name: stringField(true),
    spanType: stringField(true),
    model: stringField(true),
    provider: stringField(true),
    startedAt: orderedField('timestamp'),
    endedAt: orderedField('timestamp'),
    durationMs: orderedField('number'),
    status: stringField(true),
    error: presenceField(),
    entityType: stringField(true),
    entityId: stringField(false),
    entityName: stringField(true),
    entityVersionId: stringField(false),
    parentEntityVersionId: stringField(false),
    rootEntityVersionId: stringField(false),
  },
  scores: {
    scorerId: stringField(true),
    scorerVersion: stringField(true),
    scoreSource: stringField(true),
    score: orderedField('number'),
    timestamp: orderedField('timestamp'),
    spanId: presenceField(),
    entityVersionId: stringField(false),
    parentEntityVersionId: stringField(false),
    rootEntityVersionId: stringField(false),
  },
  feedback: {
    feedbackType: stringField(true),
    feedbackSource: stringField(true),
    feedbackUserId: stringField(false),
    sourceId: stringField(false),
    entityVersionId: stringField(false),
    parentEntityVersionId: stringField(false),
    rootEntityVersionId: stringField(false),
    value: orderedField('stringOrNumber'),
    timestamp: orderedField('timestamp'),
    comment: presenceField(),
  },
} as const satisfies Record<TraceQueryPredicateScope, Record<string, FieldRule>>;

const METADATA_FIELD_RULE: FieldRule = {
  valueKind: 'string',
  operators: TRACE_QUERY_STRING_OPERATORS,
  valueSuggestions: true,
  nonEmpty: true,
};

export type TraceQueryField = keyof (typeof TRACE_QUERY_FIELD_REGISTRY)['trace'];
export type TraceQuerySpanField = keyof (typeof TRACE_QUERY_FIELD_REGISTRY)['spans'];
export type TraceQueryScoreField = keyof (typeof TRACE_QUERY_FIELD_REGISTRY)['scores'];
export type TraceQueryFeedbackField = keyof (typeof TRACE_QUERY_FIELD_REGISTRY)['feedback'];
export type TraceQueryCanonicalField =
  | TraceQueryField
  | TraceQuerySpanField
  | TraceQueryScoreField
  | TraceQueryFeedbackField;
type TraceQueryMetadataKey = Extract<keyof NonNullable<SpanRecord['metadata']>, string>;
export type TraceQueryMetadataField = `metadata.${TraceQueryMetadataKey}`;
export type TraceQueryPredicateField = TraceQueryCanonicalField | TraceQueryMetadataField;
export type TraceQueryComparisonOperator = 'eq' | 'ne' | 'lt' | 'lte' | 'gt' | 'gte';
export type TraceQueryMembershipOperator = 'in' | 'notIn';
export type TraceQueryPresenceOperator = 'exists' | 'notExists';

export type GetTraceQueryFieldsArgs = z.input<typeof getTraceQueryFieldsArgsSchema>;
export type NormalizedGetTraceQueryFieldsArgs = z.output<typeof getTraceQueryFieldsArgsSchema>;
export type GetTraceQueryValuesArgs = z.input<typeof getTraceQueryValuesArgsSchema>;
export type NormalizedGetTraceQueryValuesArgs = z.output<typeof getTraceQueryValuesArgsSchema>;
export type TraceQueryCanonicalFieldDescriptor = z.infer<typeof traceQueryCanonicalFieldDescriptorSchema>;
export type TraceQueryObservedFieldDescriptor = z.infer<typeof traceQueryObservedFieldDescriptorSchema>;
export type GetTraceQueryFieldsResponse = z.infer<typeof getTraceQueryFieldsResponseSchema>;
export type GetTraceQueryValuesResponse = z.infer<typeof getTraceQueryValuesResponseSchema>;

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
      collection: 'spans' | 'scores' | 'feedback';
      quantifier: 'some' | 'none';
      predicate: TrustedTraceQueryScalarPredicate;
    };

export type TrustedThreadPredicate =
  | { type: 'boolean'; operator: 'and' | 'or'; args: TrustedThreadPredicate[] }
  | { type: 'not'; arg: TrustedThreadPredicate }
  | {
      type: 'relation';
      collection: 'traces';
      quantifier: 'some' | 'none';
      predicate: TrustedTraceQueryPredicate;
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

export interface TrustedThreadQueryPlan {
  result: 'threads';
  traces: {
    timeRange: { from: string; to: string };
    where?: TrustedTraceQueryPredicate;
  };
  where?: TrustedThreadPredicate;
  orderBy: { field: 'threadId'; direction: 'asc' };
  limit: number;
  binding: string;
  cursor?: { threadId: string };
}

export interface TrustedTraceQueryObservedFieldsPlan {
  timeRange: { from: string; to: string };
  predicateScope: TraceQueryPredicateScope;
  search?: string;
  limit: number;
}

export interface TrustedTraceQueryValuesPlan extends TrustedTraceQueryObservedFieldsPlan {
  path: string;
}

export interface TraceQueryObservedFieldsResult {
  observedFields: TraceQueryObservedFieldDescriptor[];
  observedFieldsTruncated: boolean;
}

export type TraceQueryCursorPlan = TrustedTraceQueryPlan | TrustedThreadQueryPlan;
export type TraceQueryCursorValues =
  | { result: 'traces'; sortValue: string; traceId: string }
  | { result: 'groups'; threadId: string }
  | { result: 'threads'; threadId: string };

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

export class TraceQueryResourceLimitError extends Error {
  readonly code = 'TRACE_QUERY_RESOURCE_LIMIT';

  constructor() {
    super('The trace query exceeded its resource limit');
    this.name = 'TraceQueryResourceLimitError';
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

type PredicateContext = TraceQueryPredicateScope;

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

function findPredicateComplexityIssue(
  input: unknown,
  rootPaths: Array<Array<string | number>>,
): Array<string | number> | undefined {
  if (!input || typeof input !== 'object') return undefined;

  const stack: Array<{ predicate: unknown; path: Array<string | number>; depth: number }> = [];
  for (let index = rootPaths.length - 1; index >= 0; index -= 1) {
    const path = rootPaths[index]!;
    let predicate: unknown = input;
    for (const part of path) {
      if (!predicate || typeof predicate !== 'object' || !Object.hasOwn(predicate, part)) {
        predicate = undefined;
        break;
      }
      predicate = (predicate as Record<string | number, unknown>)[part];
    }
    if (predicate !== undefined) stack.push({ predicate, path, depth: 1 });
  }

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

    for (const collection of ['traces', 'feedback', 'scores', 'spans'] as const) {
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

function getTraceQueryFieldRule(scope: TraceQueryPredicateScope, path: string): FieldRule | undefined {
  if (scope === 'trace' && isTraceQueryMetadataPath(path)) return METADATA_FIELD_RULE;
  const registry: Record<string, FieldRule> = TRACE_QUERY_FIELD_REGISTRY[scope];
  return Object.hasOwn(registry, path) ? registry[path] : undefined;
}

export function isTraceQueryMetadataPath(path: string): path is TraceQueryMetadataField {
  if (!path.startsWith('metadata.') || !hasMaxUtf8Bytes(path, TRACE_QUERY_MAX_PATH_BYTES)) return false;
  const key = path.slice('metadata.'.length);
  return key.length > 0 && !key.includes('.');
}

export function isTraceQueryValueSuggestionsPath(scope: TraceQueryPredicateScope, path: string): boolean {
  return getTraceQueryFieldRule(scope, normalizePath(path))?.valueSuggestions === true;
}

export function getTraceQueryCanonicalFieldDescriptors(
  scope: TraceQueryPredicateScope,
  search?: string,
): TraceQueryCanonicalFieldDescriptor[] {
  const normalizedSearch = search?.trim().toLowerCase();
  return Object.entries(TRACE_QUERY_FIELD_REGISTRY[scope])
    .filter(([path]) => !normalizedSearch || path.toLowerCase().includes(normalizedSearch))
    .map(([path, rule]) => ({
      path,
      valueKind: rule.valueKind,
      operators: [...rule.operators],
      valueSuggestions: rule.valueSuggestions,
    }));
}

export function createTraceQueryObservedFieldDescriptor(
  path: string,
  occurrences: number,
): TraceQueryObservedFieldDescriptor {
  return traceQueryObservedFieldDescriptorSchema.parse({
    path,
    valueKind: 'string',
    operators: [...TRACE_QUERY_STRING_OPERATORS],
    valueSuggestions: true,
    occurrences,
  });
}

export function parseGetTraceQueryFieldsArgs(input: unknown): NormalizedGetTraceQueryFieldsArgs {
  const result = getTraceQueryFieldsArgsSchema.safeParse(input);
  if (!result.success) throw new TraceQueryValidationError(formatTraceQuerySchemaIssues(result.error));
  return result.data;
}

export function parseGetTraceQueryValuesArgs(input: unknown): NormalizedGetTraceQueryValuesArgs {
  const result = getTraceQueryValuesArgsSchema.safeParse(input);
  if (!result.success) throw new TraceQueryValidationError(formatTraceQuerySchemaIssues(result.error));
  return result.data;
}

export function planTraceQueryObservedFields(
  args: NormalizedGetTraceQueryFieldsArgs,
): TrustedTraceQueryObservedFieldsPlan {
  return {
    timeRange: {
      from: new Date(args.timeRange.from).toISOString(),
      to: new Date(args.timeRange.to).toISOString(),
    },
    predicateScope: args.predicateScope,
    search: args.search,
    limit: args.limit,
  };
}

export function planTraceQueryValues(args: NormalizedGetTraceQueryValuesArgs): TrustedTraceQueryValuesPlan {
  return { ...planTraceQueryObservedFields(args), path: args.path };
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

export function parseQueryThreadsInput(input: unknown): NormalizedQueryThreadsInput {
  const result = queryThreadsInputSchema.safeParse(input);
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

/**
 * Converts a structurally valid thread-query request into the canonical plan consumed by
 * observability storage adapters.
 *
 * @internal This is a trusted server/storage boundary, not a client-side query builder.
 */
export function planThreadQuery(
  request: NormalizedQueryThreadsInput,
  options: { authorizationBinding?: string } = {},
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
  } else if (to.getTime() - from.getTime() > 31 * 24 * 60 * 60 * 1000) {
    issues.push({
      code: 'time_range_too_large',
      path: ['traces', 'timeRange'],
      message: 'The time range cannot exceed 31 days',
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
  const binding = digestBinding({ traces, where, result, orderBy, authorization: options.authorizationBinding });
  const cursor = request.page.after ? decodeTraceQueryCursor(request.page.after, result, binding) : undefined;

  return {
    result,
    traces,
    where,
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
          sortValue: z.string().datetime({ offset: true }),
          traceId: z.string().min(1),
        })
        .strict(),
      z.object({ result: z.literal('groups'), threadId: z.string().min(1) }).strict(),
      z.object({ result: z.literal('threads'), threadId: z.string().min(1) }).strict(),
    ]),
  })
  .strict();

function planThreadPredicate(
  predicate: ThreadPredicate,
  path: Array<string | number>,
  depth: number,
  state: PlannerState,
): TrustedThreadPredicate | undefined {
  state.nodes += 1;
  if (depth > TRACE_QUERY_MAX_DEPTH || state.nodes > TRACE_QUERY_MAX_NODES) {
    addPredicateComplexityIssue(path, PREDICATE_COMPLEXITY_MESSAGE, state);
    return undefined;
  }

  if ('traces' in predicate) {
    state.relatedClauses += 1;
    if (state.relatedClauses > TRACE_QUERY_MAX_RELATED_CLAUSES) {
      addPredicateComplexityIssue(
        path,
        `Trace queries are limited to ${TRACE_QUERY_MAX_RELATED_CLAUSES} related collection clauses`,
        state,
      );
    }
    const quantifier = 'some' in predicate.traces ? 'some' : 'none';
    const nested = 'some' in predicate.traces ? predicate.traces.some : predicate.traces.none;
    const planned = planPredicate(nested, 'trace', [...path, 'traces', quantifier], depth + 1, state);
    return planned ? { type: 'relation', collection: 'traces', quantifier, predicate: planned } : undefined;
  }

  if (predicate.op === 'and' || predicate.op === 'or') {
    const args = predicate.args
      .map((arg, index) => planThreadPredicate(arg, [...path, 'args', index], depth + 1, state))
      .filter((arg): arg is TrustedThreadPredicate => arg !== undefined);
    return { type: 'boolean', operator: predicate.op, args };
  }

  if (predicate.op === 'not') {
    const arg = planThreadPredicate(predicate.arg, [...path, 'arg'], depth + 1, state);
    return arg ? { type: 'not', arg } : undefined;
  }

  return undefined;
}

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

  if ('spans' in predicate || 'scores' in predicate || 'feedback' in predicate) {
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
    const collection = 'spans' in predicate ? 'spans' : 'scores' in predicate ? 'scores' : 'feedback';
    const clause =
      'spans' in predicate ? predicate.spans : 'scores' in predicate ? predicate.scores : predicate.feedback;
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
    if (!rule.operators.includes(predicate.op)) addOperatorIssue(predicate.op, field, [...path, 'op'], state);
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
    if (!rule.operators.includes(predicate.op)) addOperatorIssue(predicate.op, field, [...path, 'op'], state);
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
  if (!rule.operators.includes(comparison.op)) addOperatorIssue(comparison.op, field, [...path, 'op'], state);
  const value = normalizeLiteral(comparison.right.literal, rule, comparison.op);
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
  return TRACE_QUERY_FIELD_REGISTRY[context];
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
    return METADATA_FIELD_RULE;
  }
  if (!Object.hasOwn(rules, field)) {
    state.issues.push({ code: 'field_not_allowed', path, message: 'The predicate field is not allowed here' });
    return undefined;
  }
  return rules[field];
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
  const unwrapped = match?.[1] ?? path;
  const normalized = unwrapped.trim();
  if (normalized.startsWith('metadata.')) {
    const prefixIndex = unwrapped.indexOf('metadata.');
    return `metadata.${unwrapped.slice(prefixIndex + 'metadata.'.length)}`;
  }
  return normalized;
}

function normalizeLiteral(
  value: TraceQueryLiteral,
  rule: FieldRule,
  operator?: TraceQueryComparisonOperator,
): string | number | undefined {
  if (rule.valueKind === 'number') return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
  if (rule.valueKind === 'stringOrNumber') {
    if (operator && !TRACE_QUERY_STRING_OPERATORS.some(candidate => candidate === operator)) {
      return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
    }
    return typeof value === 'string' || (typeof value === 'number' && Number.isFinite(value)) ? value : undefined;
  }
  if (rule.valueKind === 'timestamp') {
    const timestamp = timestampLiteralSchema.safeParse(value);
    return timestamp.success ? new Date(timestamp.data).toISOString() : undefined;
  }
  if (rule.valueKind === 'string') {
    return typeof value === 'string' && (!rule.nonEmpty || value.trim().length > 0) ? value : undefined;
  }
  return undefined;
}

function normalizeSet(values: TraceQueryLiteral[], rule: FieldRule): Array<string | number> | undefined {
  const normalized = values.map(value => normalizeLiteral(value, rule));
  if (normalized.some(value => value === undefined)) return undefined;
  if (rule.valueKind === 'stringOrNumber' && normalized.some(value => typeof value !== typeof normalized[0]))
    return undefined;
  return normalized as Array<string | number>;
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
