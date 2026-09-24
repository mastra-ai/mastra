import { createHash } from 'node:crypto';
import { z } from 'zod/v4';
import { defaultDeltaLimit, deltaCursorSchema, deltaLimitSchema, paginationArgsSchema } from '../shared';
import type { ObservabilityStorage } from './base';
import {
  TRACE_QUERY_DISCOVERY_DEFAULT_LIMIT,
  TRACE_QUERY_DISCOVERY_MAX_LIMIT,
  TRACE_QUERY_DISCOVERY_MAX_SEARCH_LENGTH,
  TRACE_QUERY_FIELD_REGISTRY,
  TRACE_QUERY_MAX_DEPTH,
  TRACE_QUERY_MAX_LITERAL_UNITS,
  TRACE_QUERY_MAX_NODES,
  TRACE_QUERY_MAX_PATH_BYTES,
  TRACE_QUERY_MAX_RELATED_CLAUSES,
  TRACE_QUERY_MAX_SET_VALUES,
  TRACE_QUERY_MAX_STRING_BYTES,
  TRACE_QUERY_ORDERED_OPERATORS,
  TRACE_QUERY_PREDICATE_COMPLEXITY_MESSAGE,
  TRACE_QUERY_STRING_OPERATORS,
  TraceQueryCursorError,
  TraceQueryValidationError,
  compareTraceQueryStrings,
  traceQueryCanonicalFieldDescriptorSchema,
  traceQueryPredicateScopeSchema,
  traceQueryTimeRangeSchema,
} from './trace-query';
import type {
  QueryThreadsResult,
  TraceQueryCanonicalField,
  TraceQueryComparisonOperator,
  TraceQueryIssue,
  TraceQueryLiteral,
  TraceQueryMembershipOperator,
  TraceQueryOperator,
  TraceQueryPlanOptions,
  TraceQueryPredicateScope,
  TraceQueryPresenceOperator,
  TraceQueryResponse,
  TraceQueryTenantScope,
  TraceQueryValueKind,
} from './trace-query';

export const STRUCTURED_TRACE_QUERY_ROOTS = ['metadata'] as const;
export const STRUCTURED_TRACE_QUERY_MAX_PATH_SEGMENTS = 12;

const PAGINATION_MODE_CONFLICT_MESSAGE = 'Trace queries cannot combine keyset and page pagination';
const GROUP_PAGINATION_NOT_SUPPORTED_MESSAGE = 'Grouped trace queries do not support page pagination';

const hasMaxUtf8Bytes = (value: string, maxBytes: number) => Buffer.byteLength(value, 'utf8') <= maxBytes;
const structuredLiteralStringSchema = z
  .string()
  .refine(value => hasMaxUtf8Bytes(value, TRACE_QUERY_MAX_STRING_BYTES), 'String literal is too large');
const structuredCollectionMemberSchema = structuredLiteralStringSchema.refine(
  value => value.trim().length > 0,
  'Collection predicates require a non-empty string value',
);
const structuredLiteralSchema = z.union([structuredLiteralStringSchema, z.number().finite(), z.boolean(), z.null()]);
const structuredTimestampLiteralSchema = z.string().datetime({ offset: true });
const structuredPathSegmentSchema = z
  .string()
  .min(1)
  .refine(segment => !segment.includes('\0'), 'Structured path segments cannot contain NUL')
  .refine(segment => hasMaxUtf8Bytes(segment, TRACE_QUERY_MAX_PATH_BYTES), 'Structured path segment is too large');

function normalizeStructuredStringPath(path: string): string {
  const match = /^\$\{([^}]+)\}$/.exec(path.trim());
  const unwrapped = match?.[1] ?? path;
  return unwrapped.trim();
}

const structuredStringPathSchema = z
  .string()
  .min(1)
  .transform(normalizeStructuredStringPath)
  .refine(path => !path.includes('\0'), 'Predicate paths cannot contain NUL')
  .refine(path => hasMaxUtf8Bytes(path, TRACE_QUERY_MAX_PATH_BYTES), 'Predicate path is too large')
  .superRefine((path, context) => {
    if (!path.startsWith('metadata.')) return;
    const segments = path.split('.');
    if (segments.length > STRUCTURED_TRACE_QUERY_MAX_PATH_SEGMENTS) {
      context.addIssue({ code: 'custom', message: 'Structured path has too many segments' });
    }
    segments.forEach((segment, index) => {
      const parsed = structuredPathSegmentSchema.safeParse(segment);
      if (!parsed.success) {
        context.addIssue({
          code: 'custom',
          path: [index],
          message: parsed.error.issues[0]?.message ?? 'Invalid segment',
        });
      }
    });
  });

export const structuredTraceQueryExactMetadataPathSchema = z
  .tuple([z.literal('metadata'), structuredPathSegmentSchema])
  .rest(structuredPathSegmentSchema)
  .superRefine((segments, context) => {
    if (segments.length > STRUCTURED_TRACE_QUERY_MAX_PATH_SEGMENTS) {
      context.addIssue({ code: 'custom', message: 'Structured path has too many segments' });
    }
    if (!hasMaxUtf8Bytes(segments.join('.'), TRACE_QUERY_MAX_PATH_BYTES)) {
      context.addIssue({ code: 'custom', message: 'Predicate path is too large' });
    }
    if (!segments.slice(1).some(segment => segment.includes('.'))) {
      context.addIssue({ code: 'custom', message: 'Exact metadata paths require a literal dotted segment' });
    }
  });

export const structuredTraceQueryPathSchema = z.union([
  structuredStringPathSchema,
  structuredTraceQueryExactMetadataPathSchema,
]);

const structuredMetadataPathSchema = structuredTraceQueryPathSchema.refine(
  path => getStructuredTraceQueryRoot(path) === 'metadata',
  'Invalid metadata path',
);
const structuredPathRefSchema = z.object({ path: structuredTraceQueryPathSchema }).strict();
const structuredLiteralRefSchema = z.object({ literal: structuredLiteralSchema }).strict();
const structuredPathOrLiteralSchema = z.union([structuredPathRefSchema, structuredLiteralRefSchema]);

export type StructuredTraceQueryRoot = (typeof STRUCTURED_TRACE_QUERY_ROOTS)[number];
export type StructuredTraceQueryExactMetadataPath = readonly ['metadata', string, ...string[]];
export type StructuredTraceQueryPath = string | StructuredTraceQueryExactMetadataPath;
export type StructuredTraceQueryPathOrLiteral = { path: StructuredTraceQueryPath } | { literal: TraceQueryLiteral };

export type StructuredTraceQueryScalarPredicate =
  | {
      op: 'eq' | 'ne' | 'lt' | 'lte' | 'gt' | 'gte';
      left: StructuredTraceQueryPathOrLiteral;
      right: StructuredTraceQueryPathOrLiteral;
    }
  | {
      op: 'in' | 'notIn';
      value: StructuredTraceQueryPathOrLiteral;
      set: TraceQueryLiteral[];
    }
  | { op: 'exists' | 'notExists'; path: StructuredTraceQueryPath }
  | { op: 'includes' | 'notIncludes'; path: string; value: string }
  | { op: 'and' | 'or'; args: StructuredTraceQueryScalarPredicate[] }
  | { op: 'not'; arg: StructuredTraceQueryScalarPredicate };

export type StructuredTraceQueryPredicate =
  | StructuredTraceQueryScalarPredicate
  | { op: 'and' | 'or'; args: StructuredTraceQueryPredicate[] }
  | { op: 'not'; arg: StructuredTraceQueryPredicate }
  | {
      spans: { some: StructuredTraceQueryScalarPredicate } | { none: StructuredTraceQueryScalarPredicate };
    }
  | {
      scores: { some: StructuredTraceQueryScalarPredicate } | { none: StructuredTraceQueryScalarPredicate };
    }
  | {
      feedback: { some: StructuredTraceQueryScalarPredicate } | { none: StructuredTraceQueryScalarPredicate };
    };

export type StructuredThreadPredicate =
  | { op: 'and' | 'or'; args: StructuredThreadPredicate[] }
  | { op: 'not'; arg: StructuredThreadPredicate }
  | {
      traces: { some: StructuredTraceQueryPredicate } | { none: StructuredTraceQueryPredicate };
    };

export const structuredTraceQueryScalarPredicateSchema: z.ZodType<StructuredTraceQueryScalarPredicate> = z.lazy(() =>
  z.union([
    z
      .object({
        op: z.enum(['eq', 'ne', 'lt', 'lte', 'gt', 'gte']),
        left: structuredPathOrLiteralSchema,
        right: structuredPathOrLiteralSchema,
      })
      .strict(),
    z
      .object({
        op: z.enum(['in', 'notIn']),
        value: structuredPathOrLiteralSchema,
        set: z.array(structuredLiteralSchema).min(1).max(TRACE_QUERY_MAX_SET_VALUES),
      })
      .strict(),
    z.object({ op: z.enum(['exists', 'notExists']), path: structuredTraceQueryPathSchema }).strict(),
    z
      .object({
        op: z.enum(['includes', 'notIncludes']),
        path: structuredStringPathSchema,
        value: structuredCollectionMemberSchema,
      })
      .strict(),
    z.object({ op: z.enum(['and', 'or']), args: z.array(structuredTraceQueryScalarPredicateSchema).min(1) }).strict(),
    z.object({ op: z.literal('not'), arg: structuredTraceQueryScalarPredicateSchema }).strict(),
  ]),
);

export const structuredTraceQueryPredicateSchema: z.ZodType<StructuredTraceQueryPredicate> = z.lazy(() =>
  z.union([
    structuredTraceQueryScalarPredicateSchema,
    z.object({ op: z.enum(['and', 'or']), args: z.array(structuredTraceQueryPredicateSchema).min(1) }).strict(),
    z.object({ op: z.literal('not'), arg: structuredTraceQueryPredicateSchema }).strict(),
    z
      .object({
        spans: z.union([
          z.object({ some: structuredTraceQueryScalarPredicateSchema }).strict(),
          z.object({ none: structuredTraceQueryScalarPredicateSchema }).strict(),
        ]),
      })
      .strict(),
    z
      .object({
        scores: z.union([
          z.object({ some: structuredTraceQueryScalarPredicateSchema }).strict(),
          z.object({ none: structuredTraceQueryScalarPredicateSchema }).strict(),
        ]),
      })
      .strict(),
    z
      .object({
        feedback: z.union([
          z.object({ some: structuredTraceQueryScalarPredicateSchema }).strict(),
          z.object({ none: structuredTraceQueryScalarPredicateSchema }).strict(),
        ]),
      })
      .strict(),
  ]),
);

export const structuredTraceSelectionSchema = z
  .object({
    timeRange: traceQueryTimeRangeSchema,
    where: structuredTraceQueryPredicateSchema.optional(),
  })
  .strict();

export const structuredThreadPredicateSchema: z.ZodType<StructuredThreadPredicate> = z.lazy(() =>
  z.union([
    z.object({ op: z.enum(['and', 'or']), args: z.array(structuredThreadPredicateSchema).min(1) }).strict(),
    z.object({ op: z.literal('not'), arg: structuredThreadPredicateSchema }).strict(),
    z
      .object({
        traces: z.union([
          z.object({ some: structuredTraceQueryPredicateSchema }).strict(),
          z.object({ none: structuredTraceQueryPredicateSchema }).strict(),
        ]),
      })
      .strict(),
  ]),
);

const structuredPageSchema = z
  .object({
    limit: z.number().int().min(1).max(1000).default(100),
    after: z.string().min(1).nullable().optional(),
  })
  .strict();

const structuredTraceQueryRequestObjectSchema = z
  .object({
    timeRange: traceQueryTimeRangeSchema,
    where: structuredTraceQueryPredicateSchema.optional(),
    /**
     * @deprecated Use `queryStructuredThreads()` instead. Grouped structured trace queries remain supported until the next major release.
     */
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
    page: structuredPageSchema.optional(),
    pagination: paginationArgsSchema.optional(),
    mode: z.literal('delta').optional(),
    after: deltaCursorSchema.optional(),
    limit: deltaLimitSchema,
  })
  .strict()
  .superRefine((request, context) => {
    if (request.mode === 'delta') {
      for (const field of ['page', 'pagination', 'group', 'orderBy'] as const) {
        if (request[field] !== undefined) {
          context.addIssue({ code: 'custom', path: [field], message: `Delta trace queries do not support ${field}` });
        }
      }
    } else {
      for (const field of ['after', 'limit'] as const) {
        if (request[field] !== undefined) {
          context.addIssue({ code: 'custom', path: [field], message: `${field} requires delta mode` });
        }
      }
    }
    if (request.page && request.pagination) {
      context.addIssue({ code: 'custom', path: ['pagination'], message: PAGINATION_MODE_CONFLICT_MESSAGE });
    }
    if (request.group && request.pagination) {
      context.addIssue({ code: 'custom', path: ['pagination'], message: GROUP_PAGINATION_NOT_SUPPORTED_MESSAGE });
    }
  });

export const structuredTraceQueryRequestSchema = z.preprocess((input, context) => {
  const issuePath = findStructuredPredicateComplexityIssue(input, [['where']]);
  if (issuePath) {
    context.addIssue({ code: 'custom', path: issuePath, message: TRACE_QUERY_PREDICATE_COMPLEXITY_MESSAGE });
    return z.NEVER;
  }
  return input;
}, structuredTraceQueryRequestObjectSchema);

const structuredQueryThreadsInputObjectSchema = z
  .object({
    traces: structuredTraceSelectionSchema,
    where: structuredThreadPredicateSchema.optional(),
    page: structuredPageSchema.default({ limit: 100 }),
  })
  .strict();

export const structuredQueryThreadsInputSchema = z.preprocess((input, context) => {
  const issuePath = findStructuredPredicateComplexityIssue(input, [['traces', 'where'], ['where']]);
  if (issuePath) {
    context.addIssue({ code: 'custom', path: issuePath, message: TRACE_QUERY_PREDICATE_COMPLEXITY_MESSAGE });
    return z.NEVER;
  }
  return input;
}, structuredQueryThreadsInputObjectSchema);

const structuredDiscoveryTimeRangeSchema = traceQueryTimeRangeSchema.superRefine((timeRange, context) => {
  const from = new Date(timeRange.from);
  const to = new Date(timeRange.to);
  if (from >= to) {
    context.addIssue({ code: 'custom', path: [], message: '`from` must be earlier than `to`' });
  } else if (to.getTime() - from.getTime() > 31 * 24 * 60 * 60 * 1000) {
    context.addIssue({ code: 'custom', path: [], message: 'The time range cannot exceed 31 days' });
  }
});
const structuredDiscoverySearchSchema = z.string().trim().max(TRACE_QUERY_DISCOVERY_MAX_SEARCH_LENGTH).optional();
const structuredDiscoveryLimitSchema = z
  .number()
  .int()
  .min(1)
  .max(TRACE_QUERY_DISCOVERY_MAX_LIMIT)
  .default(TRACE_QUERY_DISCOVERY_DEFAULT_LIMIT);

export const getStructuredTraceQueryFieldsArgsSchema = z
  .object({
    timeRange: structuredDiscoveryTimeRangeSchema,
    predicateScope: traceQueryPredicateScopeSchema,
    search: structuredDiscoverySearchSchema,
    limit: structuredDiscoveryLimitSchema,
  })
  .strict();

export const getStructuredTraceQueryValuesArgsSchema = z
  .object({
    timeRange: structuredDiscoveryTimeRangeSchema,
    predicateScope: traceQueryPredicateScopeSchema,
    path: structuredTraceQueryPathSchema,
    search: structuredDiscoverySearchSchema,
    limit: structuredDiscoveryLimitSchema,
  })
  .strict();

export const structuredTraceQueryObservedValueKindSchema = z.enum(['string', 'number', 'boolean']);
export const structuredTraceQueryObservedFieldDescriptorSchema = z
  .object({
    path: structuredMetadataPathSchema,
    valueKind: structuredTraceQueryObservedValueKindSchema,
    operators: z.array(z.enum(['eq', 'ne', 'lt', 'lte', 'gt', 'gte', 'in', 'notIn', 'exists', 'notExists'])),
    valueSuggestions: z.literal(true),
    occurrences: z.number().int().nonnegative(),
  })
  .strict()
  .superRefine((descriptor, context) => {
    const allowed = descriptor.valueKind === 'number' ? TRACE_QUERY_ORDERED_OPERATORS : TRACE_QUERY_STRING_OPERATORS;
    descriptor.operators.forEach((operator, index) => {
      if (!allowed.some(candidate => candidate === operator)) {
        context.addIssue({
          code: 'custom',
          path: ['operators', index],
          message: `Operator ${operator} is not valid for ${descriptor.valueKind} metadata`,
        });
      }
    });
  });
export const getStructuredTraceQueryFieldsResponseSchema = z
  .object({
    canonicalFields: z.array(traceQueryCanonicalFieldDescriptorSchema),
    observedFields: z.array(structuredTraceQueryObservedFieldDescriptorSchema).max(TRACE_QUERY_DISCOVERY_MAX_LIMIT),
    observedFieldsTruncated: z.boolean(),
  })
  .strict();
export const getStructuredTraceQueryValuesResponseSchema = z
  .object({
    values: z
      .array(
        z
          .object({
            value: z.union([structuredLiteralStringSchema, z.number().finite(), z.boolean()]),
            count: z.number().int().nonnegative(),
          })
          .strict(),
      )
      .max(TRACE_QUERY_DISCOVERY_MAX_LIMIT),
    valuesTruncated: z.boolean(),
  })
  .strict();

type StructuredTraceQueryRequestInput = z.input<typeof structuredTraceQueryRequestObjectSchema>;
export type StructuredTraceQueryRequest = Omit<StructuredTraceQueryRequestInput, 'group'> & {
  /**
   * @deprecated Use `queryStructuredThreads()` instead. Grouped structured trace queries remain supported until the next major release.
   */
  group?: StructuredTraceQueryRequestInput['group'];
};
export type NormalizedStructuredTraceQueryRequest = z.output<typeof structuredTraceQueryRequestObjectSchema>;
export type StructuredQueryThreadsInput = z.input<typeof structuredQueryThreadsInputObjectSchema>;
export type NormalizedStructuredQueryThreadsInput = z.output<typeof structuredQueryThreadsInputObjectSchema>;
export type GetStructuredTraceQueryFieldsArgs = z.input<typeof getStructuredTraceQueryFieldsArgsSchema>;
export type NormalizedGetStructuredTraceQueryFieldsArgs = z.output<typeof getStructuredTraceQueryFieldsArgsSchema>;
export type GetStructuredTraceQueryValuesArgs = z.input<typeof getStructuredTraceQueryValuesArgsSchema>;
export type NormalizedGetStructuredTraceQueryValuesArgs = z.output<typeof getStructuredTraceQueryValuesArgsSchema>;
export type StructuredTraceQueryObservedValueKind = z.infer<typeof structuredTraceQueryObservedValueKindSchema>;
export type StructuredTraceQueryObservedFieldDescriptor = z.infer<
  typeof structuredTraceQueryObservedFieldDescriptorSchema
>;
export type GetStructuredTraceQueryFieldsResponse = z.infer<typeof getStructuredTraceQueryFieldsResponseSchema>;
export type GetStructuredTraceQueryValuesResponse = z.infer<typeof getStructuredTraceQueryValuesResponseSchema>;

export type StructuredTraceQuerySegments = ['metadata', string, ...string[]];
export type StructuredTraceQueryPredicateField = TraceQueryCanonicalField | StructuredTraceQuerySegments;
export type StructuredTraceQueryScalarValue = string | number | boolean;

export type TrustedStructuredTraceQueryScalarPredicate =
  | {
      type: 'comparison';
      field: StructuredTraceQueryPredicateField;
      operator: TraceQueryComparisonOperator;
      value: StructuredTraceQueryScalarValue;
    }
  | {
      type: 'membership';
      field: StructuredTraceQueryPredicateField;
      operator: TraceQueryMembershipOperator;
      values: StructuredTraceQueryScalarValue[];
    }
  | { type: 'presence'; field: StructuredTraceQueryPredicateField; operator: TraceQueryPresenceOperator }
  | {
      type: 'collection';
      field: StructuredTraceQueryPredicateField;
      operator: 'includes' | 'notIncludes';
      value: string;
    }
  | { type: 'collection'; field: StructuredTraceQueryPredicateField; operator: 'empty' | 'notEmpty' }
  | { type: 'boolean'; operator: 'and' | 'or'; args: TrustedStructuredTraceQueryScalarPredicate[] }
  | { type: 'not'; arg: TrustedStructuredTraceQueryScalarPredicate };

export type TrustedStructuredTraceQueryPredicate =
  | TrustedStructuredTraceQueryScalarPredicate
  | { type: 'boolean'; operator: 'and' | 'or'; args: TrustedStructuredTraceQueryPredicate[] }
  | { type: 'not'; arg: TrustedStructuredTraceQueryPredicate }
  | {
      type: 'relation';
      collection: 'spans' | 'scores' | 'feedback';
      quantifier: 'some' | 'none';
      predicate: TrustedStructuredTraceQueryScalarPredicate;
    };

export type TrustedStructuredThreadPredicate =
  | { type: 'boolean'; operator: 'and' | 'or'; args: TrustedStructuredThreadPredicate[] }
  | { type: 'not'; arg: TrustedStructuredThreadPredicate }
  | {
      type: 'relation';
      collection: 'traces';
      quantifier: 'some' | 'none';
      predicate: TrustedStructuredTraceQueryPredicate;
    };

export interface TrustedStructuredTraceQueryBasePlan {
  timeRange: { from: string; to: string };
  where?: TrustedStructuredTraceQueryPredicate;
  structuredRoots: StructuredTraceQueryRoot[];
  scope?: TraceQueryTenantScope;
}

interface TrustedStructuredTraceQueryTracesBasePlan extends TrustedStructuredTraceQueryBasePlan {
  result: 'traces';
  orderBy: { field: 'startedAt' | 'endedAt'; direction: 'asc' | 'desc' };
}

export type TrustedStructuredTraceQueryKeysetTracesPlan = TrustedStructuredTraceQueryTracesBasePlan & {
  paginationMode: 'keyset';
  limit: number;
  binding: string;
  cursor?: { sortValue: string; traceId: string };
};
export type TrustedStructuredTraceQueryPaginatedTracesPlan = TrustedStructuredTraceQueryTracesBasePlan & {
  paginationMode: 'page';
  page: number;
  perPage: number;
  deltaBinding: string;
};
export type TrustedStructuredTraceQueryDeltaTracesPlan = TrustedStructuredTraceQueryTracesBasePlan & {
  paginationMode: 'delta';
  limit: number;
  binding: string;
  deltaCursor?: { adapter: string; watermark: string };
};
export type TrustedStructuredTraceQueryTracesPlan =
  | TrustedStructuredTraceQueryKeysetTracesPlan
  | TrustedStructuredTraceQueryPaginatedTracesPlan
  | TrustedStructuredTraceQueryDeltaTracesPlan;
/**
 * @deprecated Use `TrustedStructuredThreadQueryPlan` instead. Grouped structured trace queries remain supported until the next major release.
 */
export type TrustedStructuredTraceQueryGroupsPlan = TrustedStructuredTraceQueryBasePlan & {
  result: 'groups';
  orderBy: { field: 'threadId'; direction: 'asc' };
  paginationMode: 'keyset';
  limit: number;
  binding: string;
  cursor?: { threadId: string };
};
export type TrustedStructuredTraceQueryPlan =
  | TrustedStructuredTraceQueryTracesPlan
  | TrustedStructuredTraceQueryGroupsPlan;

export interface TrustedStructuredThreadQueryPlan {
  result: 'threads';
  traces: {
    timeRange: { from: string; to: string };
    where?: TrustedStructuredTraceQueryPredicate;
  };
  where?: TrustedStructuredThreadPredicate;
  structuredRoots: StructuredTraceQueryRoot[];
  scope?: TraceQueryTenantScope;
  orderBy: { field: 'threadId'; direction: 'asc' };
  limit: number;
  binding: string;
  cursor?: { threadId: string };
}

export interface TrustedStructuredTraceQueryObservedFieldsPlan {
  timeRange: { from: string; to: string };
  predicateScope: TraceQueryPredicateScope;
  structuredRoots: StructuredTraceQueryRoot[];
  search?: string;
  limit: number;
  scope?: TraceQueryTenantScope;
}

export interface TrustedStructuredTraceQueryValuesPlan extends TrustedStructuredTraceQueryObservedFieldsPlan {
  path: TraceQueryCanonicalField | StructuredTraceQuerySegments;
}

export interface StructuredTraceQueryObservedFieldsResult {
  observedFields: StructuredTraceQueryObservedFieldDescriptor[];
  observedFieldsTruncated: boolean;
}

export type StructuredTraceQueryValuesResult = GetStructuredTraceQueryValuesResponse;

export type StructuredTraceQueryStorageFeature =
  | 'trace-query-structured-paths'
  | 'thread-query-structured-paths'
  | 'trace-query-structured-discovery';

export interface StructuredTraceQueryFeatureReporter {
  getStructuredTraceQueryFeatures(): readonly StructuredTraceQueryStorageFeature[];
}

export interface StructuredTraceQueryExecutionStorage extends StructuredTraceQueryFeatureReporter {
  queryStructuredTraces(plan: TrustedStructuredTraceQueryPlan): Promise<TraceQueryResponse>;
}

export interface StructuredThreadQueryExecutionStorage extends StructuredTraceQueryFeatureReporter {
  queryStructuredThreads(plan: TrustedStructuredThreadQueryPlan): Promise<QueryThreadsResult>;
}

export interface StructuredTraceQueryDiscoveryStorage extends StructuredTraceQueryFeatureReporter {
  getStructuredTraceQueryObservedFields(
    plan: TrustedStructuredTraceQueryObservedFieldsPlan,
  ): Promise<StructuredTraceQueryObservedFieldsResult>;
  getStructuredTraceQueryValues(plan: TrustedStructuredTraceQueryValuesPlan): Promise<StructuredTraceQueryValuesResult>;
}

function isRecord(value: unknown): value is Record<PropertyKey, unknown> {
  return typeof value === 'object' && value !== null;
}

function reportsStructuredFeature(
  storage: ObservabilityStorage,
  feature: StructuredTraceQueryStorageFeature,
): storage is ObservabilityStorage & StructuredTraceQueryFeatureReporter {
  if (!isRecord(storage) || typeof storage.getStructuredTraceQueryFeatures !== 'function') return false;
  const features = storage.getStructuredTraceQueryFeatures();
  return Array.isArray(features) && features.includes(feature);
}

export function supportsStructuredTraceQueryExecution(
  storage: ObservabilityStorage,
): storage is ObservabilityStorage & StructuredTraceQueryExecutionStorage {
  const candidate: unknown = storage;
  return (
    reportsStructuredFeature(storage, 'trace-query-structured-paths') &&
    isRecord(candidate) &&
    typeof candidate.queryStructuredTraces === 'function'
  );
}

export function supportsStructuredThreadQueryExecution(
  storage: ObservabilityStorage,
): storage is ObservabilityStorage & StructuredThreadQueryExecutionStorage {
  const candidate: unknown = storage;
  return (
    reportsStructuredFeature(storage, 'thread-query-structured-paths') &&
    isRecord(candidate) &&
    typeof candidate.queryStructuredThreads === 'function'
  );
}

export function supportsStructuredTraceQueryDiscovery(
  storage: ObservabilityStorage,
): storage is ObservabilityStorage & StructuredTraceQueryDiscoveryStorage {
  const candidate: unknown = storage;
  return (
    reportsStructuredFeature(storage, 'trace-query-structured-discovery') &&
    isRecord(candidate) &&
    typeof candidate.getStructuredTraceQueryObservedFields === 'function' &&
    typeof candidate.getStructuredTraceQueryValues === 'function'
  );
}

function isStructuredTraceQueryExactPath(
  path: StructuredTraceQueryPath,
): path is StructuredTraceQueryExactMetadataPath {
  return typeof path !== 'string';
}

export function getStructuredTraceQueryRoot(path: StructuredTraceQueryPath): StructuredTraceQueryRoot | undefined {
  const root = isStructuredTraceQueryExactPath(path) ? path[0] : normalizeStructuredStringPath(path).split('.')[0];
  return root === 'metadata' ? root : undefined;
}

export function normalizeStructuredTraceQueryPath(
  path: StructuredTraceQueryPath,
): string | StructuredTraceQuerySegments {
  if (isStructuredTraceQueryExactPath(path)) return ['metadata', path[1], ...path.slice(2)];
  const normalized = normalizeStructuredStringPath(path);
  if (!normalized.startsWith('metadata.')) return normalized;
  const segments = normalized.split('.');
  const firstSegment = segments[1];
  return firstSegment === undefined ? normalized : ['metadata', firstSegment, ...segments.slice(2)];
}

export function serializeStructuredTraceQueryPath(path: StructuredTraceQueryPath): string {
  const normalized = normalizeStructuredTraceQueryPath(path);
  return Array.isArray(normalized) && normalized.slice(1).some(segment => segment.includes('.'))
    ? JSON.stringify(normalized)
    : Array.isArray(normalized)
      ? normalized.join('.')
      : normalized;
}

export function createStructuredTraceQueryObservedFieldDescriptor(
  path: StructuredTraceQueryPath,
  valueKind: StructuredTraceQueryObservedValueKind,
  occurrences: number,
): StructuredTraceQueryObservedFieldDescriptor {
  return structuredTraceQueryObservedFieldDescriptorSchema.parse({
    path,
    valueKind,
    operators: valueKind === 'number' ? [...TRACE_QUERY_ORDERED_OPERATORS] : [...TRACE_QUERY_STRING_OPERATORS],
    valueSuggestions: true,
    occurrences,
  });
}

export function parseStructuredTraceQueryRequest(input: unknown): NormalizedStructuredTraceQueryRequest {
  const result = structuredTraceQueryRequestSchema.safeParse(input);
  if (!result.success) throw new TraceQueryValidationError(formatStructuredSchemaIssues(result.error));
  return result.data;
}

export function parseStructuredQueryThreadsInput(input: unknown): NormalizedStructuredQueryThreadsInput {
  const result = structuredQueryThreadsInputSchema.safeParse(input);
  if (!result.success) throw new TraceQueryValidationError(formatStructuredSchemaIssues(result.error));
  return result.data;
}

export function parseGetStructuredTraceQueryFieldsArgs(input: unknown): NormalizedGetStructuredTraceQueryFieldsArgs {
  const result = getStructuredTraceQueryFieldsArgsSchema.safeParse(input);
  if (!result.success) throw new TraceQueryValidationError(formatStructuredSchemaIssues(result.error));
  return result.data;
}

export function parseGetStructuredTraceQueryValuesArgs(input: unknown): NormalizedGetStructuredTraceQueryValuesArgs {
  const result = getStructuredTraceQueryValuesArgsSchema.safeParse(input);
  if (!result.success) throw new TraceQueryValidationError(formatStructuredSchemaIssues(result.error));
  return result.data;
}

export function planStructuredTraceQueryObservedFields(
  args: NormalizedGetStructuredTraceQueryFieldsArgs,
  options: Pick<TraceQueryPlanOptions, 'scope'> = {},
): TrustedStructuredTraceQueryObservedFieldsPlan {
  return {
    timeRange: normalizeTimeRange(args.timeRange),
    predicateScope: args.predicateScope,
    structuredRoots: [...STRUCTURED_TRACE_QUERY_ROOTS],
    search: args.search,
    limit: args.limit,
    scope: normalizeTenantScope(options.scope),
  };
}

export function planStructuredTraceQueryValues(
  args: NormalizedGetStructuredTraceQueryValuesArgs,
  options: Pick<TraceQueryPlanOptions, 'scope'> = {},
): TrustedStructuredTraceQueryValuesPlan {
  const state = createPlannerState();
  const field = getStructuredField(args.path, args.predicateScope, ['path'], state);
  if (!field || state.issues.length > 0) throw new TraceQueryValidationError(state.issues);
  const rule = getStructuredRule(field, args.predicateScope, ['path'], state);
  if (!rule?.valueSuggestions) {
    state.issues.push({
      code: 'field_not_allowed',
      path: ['path'],
      message: 'Value suggestions are not available for this path',
    });
  }
  if (state.issues.length > 0) throw new TraceQueryValidationError(state.issues);
  return {
    ...planStructuredTraceQueryObservedFields(args, options),
    structuredRoots: Array.isArray(field) ? [field[0]] : [],
    path: field,
  };
}

export function planStructuredTraceQuery(
  request: NormalizedStructuredTraceQueryRequest,
  options: TraceQueryPlanOptions = {},
): TrustedStructuredTraceQueryPlan {
  const state = createPlannerState();
  const from = new Date(request.timeRange.from);
  const to = new Date(request.timeRange.to);
  validateTimeRange(from, to, ['timeRange'], state.issues);
  if (request.group && request.orderBy) {
    state.issues.push({
      code: 'group_order_not_supported',
      path: ['orderBy'],
      message: 'Grouped trace queries use fixed threadId ordering',
    });
  }
  const where = request.where ? planStructuredPredicate(request.where, 'trace', ['where'], 1, state) : undefined;
  if (state.issues.length > 0) throw new TraceQueryValidationError(state.issues);

  const timeRange = { from: from.toISOString(), to: to.toISOString() };
  const scope = normalizeTenantScope(options.scope);
  const structuredRoots = sortedStructuredRoots(state.structuredRoots);
  if (request.group) {
    const result = 'groups' as const;
    const orderBy = { field: 'threadId', direction: 'asc' } as const;
    const binding = digestStructuredBinding({
      timeRange,
      where,
      result,
      orderBy,
      structuredRoots,
      authorization: options.authorizationBinding,
      scope,
    });
    const page = request.page ?? { limit: 100 };
    const cursor = page.after ? decodeStructuredCursor(page.after, result, binding) : undefined;
    return {
      result,
      timeRange,
      where,
      structuredRoots,
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
  const deltaBinding = digestStructuredBinding({
    timeRange,
    where,
    result: 'trace-delta',
    structuredRoots,
    authorization: options.authorizationBinding,
    scope,
  });
  if (request.mode === 'delta') {
    return {
      result,
      timeRange,
      where,
      structuredRoots,
      scope,
      orderBy,
      paginationMode: 'delta',
      limit: request.limit ?? defaultDeltaLimit,
      binding: deltaBinding,
      deltaCursor: request.after === undefined ? undefined : decodeStructuredDeltaCursor(request.after, deltaBinding),
    };
  }
  if (request.pagination) {
    return {
      result,
      timeRange,
      where,
      structuredRoots,
      scope,
      orderBy,
      paginationMode: 'page',
      page: request.pagination.page,
      perPage: request.pagination.perPage,
      deltaBinding,
    };
  }

  const page = request.page ?? { limit: 100 };
  const binding = digestStructuredBinding({
    timeRange,
    where,
    result,
    orderBy,
    structuredRoots,
    authorization: options.authorizationBinding,
    scope,
  });
  const cursor = page.after ? decodeStructuredCursor(page.after, result, binding) : undefined;
  return {
    result,
    timeRange,
    where,
    structuredRoots,
    scope,
    orderBy,
    paginationMode: 'keyset',
    limit: page.limit,
    binding,
    cursor: cursor?.result === 'traces' ? { sortValue: cursor.sortValue, traceId: cursor.traceId } : undefined,
  };
}

export function planStructuredThreadQuery(
  request: NormalizedStructuredQueryThreadsInput,
  options: TraceQueryPlanOptions = {},
): TrustedStructuredThreadQueryPlan {
  const state = createPlannerState();
  const from = new Date(request.traces.timeRange.from);
  const to = new Date(request.traces.timeRange.to);
  validateTimeRange(from, to, ['traces', 'timeRange'], state.issues);
  const traceWhere = request.traces.where
    ? planStructuredPredicate(request.traces.where, 'trace', ['traces', 'where'], 1, state)
    : undefined;
  const where = request.where ? planStructuredThreadPredicate(request.where, ['where'], 1, state) : undefined;
  if (state.issues.length > 0) throw new TraceQueryValidationError(state.issues);

  const result = 'threads' as const;
  const traces = {
    timeRange: { from: from.toISOString(), to: to.toISOString() },
    where: traceWhere,
  };
  const orderBy = { field: 'threadId', direction: 'asc' } as const;
  const scope = normalizeTenantScope(options.scope);
  const structuredRoots = sortedStructuredRoots(state.structuredRoots);
  const binding = digestStructuredBinding({
    traces,
    where,
    result,
    orderBy,
    structuredRoots,
    authorization: options.authorizationBinding,
    scope,
  });
  const cursor = request.page.after ? decodeStructuredCursor(request.page.after, result, binding) : undefined;
  return {
    result,
    traces,
    where,
    structuredRoots,
    scope,
    orderBy,
    limit: request.page.limit,
    binding,
    cursor: cursor?.result === 'threads' ? { threadId: cursor.threadId } : undefined,
  };
}

export type StructuredTraceQueryCursorPlan =
  | TrustedStructuredTraceQueryKeysetTracesPlan
  | TrustedStructuredTraceQueryGroupsPlan
  | TrustedStructuredThreadQueryPlan;
export type StructuredTraceQueryCursorValues =
  | { result: 'traces'; sortValue: string; traceId: string }
  | { result: 'groups'; threadId: string }
  | { result: 'threads'; threadId: string };

export function encodeStructuredTraceQueryCursor(
  plan: StructuredTraceQueryCursorPlan,
  values: StructuredTraceQueryCursorValues,
): string {
  if (values.result !== plan.result) throw new TraceQueryCursorError('TRACE_QUERY_CURSOR_CONFLICT');
  return Buffer.from(JSON.stringify({ version: 1, binding: plan.binding, values }), 'utf8').toString('base64url');
}

const structuredDeltaCursorEnvelopeSchema = z
  .object({
    version: z.literal(1),
    kind: z.literal('trace-delta'),
    binding: z.string().length(64),
    adapter: z.string().min(1).max(100),
    watermark: z.string().min(1).max(4096),
  })
  .strict();

export function encodeStructuredTraceQueryDeltaCursor(
  plan: TrustedStructuredTraceQueryPaginatedTracesPlan | TrustedStructuredTraceQueryDeltaTracesPlan,
  adapter: string,
  watermark: string,
): string {
  const envelope = structuredDeltaCursorEnvelopeSchema.parse({
    version: 1,
    kind: 'trace-delta',
    binding: 'deltaBinding' in plan ? plan.deltaBinding : plan.binding,
    adapter,
    watermark,
  });
  return Buffer.from(JSON.stringify(envelope), 'utf8').toString('base64url');
}

export function getStructuredTraceQueryDeltaWatermark(
  plan: TrustedStructuredTraceQueryDeltaTracesPlan,
  adapter: string,
): string | undefined {
  if (plan.deltaCursor && plan.deltaCursor.adapter !== adapter) {
    throw new TraceQueryCursorError('TRACE_QUERY_CURSOR_CONFLICT');
  }
  return plan.deltaCursor?.watermark;
}

interface StructuredFieldRule {
  valueKind: TraceQueryValueKind | 'scalar';
  operators: readonly TraceQueryOperator[];
  valueSuggestions: boolean;
  nonEmpty?: boolean;
}

interface StructuredPlannerState {
  nodes: number;
  relatedClauses: number;
  literalUnits: number;
  issues: TraceQueryIssue[];
  structuredRoots: Set<StructuredTraceQueryRoot>;
}

type StructuredPredicateContext = TraceQueryPredicateScope;

function createPlannerState(): StructuredPlannerState {
  return { nodes: 0, relatedClauses: 0, literalUnits: 0, issues: [], structuredRoots: new Set() };
}

function planStructuredThreadPredicate(
  predicate: StructuredThreadPredicate,
  path: Array<string | number>,
  depth: number,
  state: StructuredPlannerState,
): TrustedStructuredThreadPredicate | undefined {
  state.nodes += 1;
  if (depth > TRACE_QUERY_MAX_DEPTH || state.nodes > TRACE_QUERY_MAX_NODES) {
    addStructuredComplexityIssue(path, state);
    return undefined;
  }
  if ('traces' in predicate) {
    state.relatedClauses += 1;
    if (state.relatedClauses > TRACE_QUERY_MAX_RELATED_CLAUSES) addRelatedClauseIssue(path, state);
    const quantifier = 'some' in predicate.traces ? 'some' : 'none';
    const nested = 'some' in predicate.traces ? predicate.traces.some : predicate.traces.none;
    const planned = planStructuredPredicate(nested, 'trace', [...path, 'traces', quantifier], depth + 1, state);
    return planned ? { type: 'relation', collection: 'traces', quantifier, predicate: planned } : undefined;
  }
  if (predicate.op === 'and' || predicate.op === 'or') {
    const args = predicate.args
      .map((arg, index) => planStructuredThreadPredicate(arg, [...path, 'args', index], depth + 1, state))
      .filter((arg): arg is TrustedStructuredThreadPredicate => arg !== undefined);
    return { type: 'boolean', operator: predicate.op, args };
  }
  if (predicate.op === 'not') {
    const arg = planStructuredThreadPredicate(predicate.arg, [...path, 'arg'], depth + 1, state);
    return arg ? { type: 'not', arg } : undefined;
  }
  return undefined;
}

function planStructuredPredicate(
  predicate: StructuredTraceQueryPredicate | StructuredTraceQueryScalarPredicate,
  context: StructuredPredicateContext,
  path: Array<string | number>,
  depth: number,
  state: StructuredPlannerState,
): TrustedStructuredTraceQueryPredicate | TrustedStructuredTraceQueryScalarPredicate | undefined {
  state.nodes += 1;
  if (depth > TRACE_QUERY_MAX_DEPTH || state.nodes > TRACE_QUERY_MAX_NODES) {
    addStructuredComplexityIssue(path, state);
    return undefined;
  }

  if ('spans' in predicate || 'scores' in predicate || 'feedback' in predicate) {
    state.relatedClauses += 1;
    if (state.relatedClauses > TRACE_QUERY_MAX_RELATED_CLAUSES) addRelatedClauseIssue(path, state);
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
    const planned = planStructuredPredicate(nested, collection, [...path, collection, quantifier], depth + 1, state);
    return planned && isTrustedStructuredScalarPredicate(planned)
      ? { type: 'relation', collection, quantifier, predicate: planned }
      : undefined;
  }

  if (predicate.op === 'and' || predicate.op === 'or') {
    const args = predicate.args
      .map((arg, index) => planStructuredPredicate(arg, context, [...path, 'args', index], depth + 1, state))
      .filter((arg): arg is TrustedStructuredTraceQueryPredicate => arg !== undefined);
    return { type: 'boolean', operator: predicate.op, args };
  }
  if (predicate.op === 'not') {
    const arg = planStructuredPredicate(predicate.arg, context, [...path, 'arg'], depth + 1, state);
    return arg ? { type: 'not', arg } : undefined;
  }

  if (predicate.op === 'exists' || predicate.op === 'notExists') {
    const field = getStructuredField(predicate.path, context, [...path, 'path'], state);
    if (!field) return undefined;
    const rule = getStructuredRule(field, context, [...path, 'path'], state);
    if (!rule) return undefined;
    if (!rule.operators.includes(predicate.op)) addOperatorIssue(predicate.op, field, [...path, 'op'], state);
    if (rule.valueKind === 'array') {
      return {
        type: 'collection',
        field,
        operator: predicate.op === 'exists' ? 'notEmpty' : 'empty',
      };
    }
    return { type: 'presence', field, operator: predicate.op };
  }

  if (predicate.op === 'includes' || predicate.op === 'notIncludes') {
    countLiteralUnits(1, [...path, 'value'], state);
    const field = getStructuredField(predicate.path, context, [...path, 'path'], state);
    if (!field) return undefined;
    const rule = getStructuredRule(field, context, [...path, 'path'], state);
    if (!rule) return undefined;
    if (!rule.operators.includes(predicate.op)) addOperatorIssue(predicate.op, field, [...path, 'op'], state);
    return { type: 'collection', field, operator: predicate.op, value: predicate.value };
  }

  if (predicate.op === 'in' || predicate.op === 'notIn') {
    countLiteralUnits(predicate.set.length, [...path, 'set'], state);
    if (!('path' in predicate.value)) {
      state.issues.push({
        code: 'invalid_operands',
        path: [...path, 'value'],
        message: 'Membership predicates require an allowlisted field path',
      });
      return undefined;
    }
    const field = getStructuredField(predicate.value.path, context, [...path, 'value', 'path'], state);
    if (!field) return undefined;
    const rule = getStructuredRule(field, context, [...path, 'value', 'path'], state);
    if (!rule) return undefined;
    if (!rule.operators.includes(predicate.op)) addOperatorIssue(predicate.op, field, [...path, 'op'], state);
    const values = normalizeStructuredSet(predicate.set, rule);
    if (!values) {
      state.issues.push({
        code: 'invalid_literal',
        path: [...path, 'set'],
        message: 'Membership values must be homogeneous and match the selected field type',
      });
      return undefined;
    }
    return { type: 'membership', field, operator: predicate.op, values };
  }

  countLiteralUnits(1, [...path, 'right', 'literal'], state);
  if (
    !('left' in predicate) ||
    !('right' in predicate) ||
    !('path' in predicate.left) ||
    !('literal' in predicate.right)
  ) {
    state.issues.push({
      code: 'invalid_operands',
      path,
      message: 'Comparison predicates require a field on the left and a literal on the right',
    });
    return undefined;
  }
  const field = getStructuredField(predicate.left.path, context, [...path, 'left', 'path'], state);
  if (!field) return undefined;
  const rule = getStructuredRule(field, context, [...path, 'left', 'path'], state);
  if (!rule) return undefined;
  if (!rule.operators.includes(predicate.op)) addOperatorIssue(predicate.op, field, [...path, 'op'], state);
  const value = normalizeStructuredLiteral(predicate.right.literal, rule, predicate.op);
  if (value === undefined) {
    state.issues.push({
      code: 'invalid_literal',
      path: [...path, 'right', 'literal'],
      message: 'The literal does not match the selected field type',
    });
    return undefined;
  }
  return { type: 'comparison', field, operator: predicate.op, value };
}

function isTrustedStructuredScalarPredicate(
  predicate: TrustedStructuredTraceQueryPredicate,
): predicate is TrustedStructuredTraceQueryScalarPredicate {
  return predicate.type !== 'relation';
}

function getStructuredField(
  path: StructuredTraceQueryPath,
  context: StructuredPredicateContext,
  issuePath: Array<string | number>,
  state: StructuredPlannerState,
): StructuredTraceQueryPredicateField | undefined {
  const normalized = normalizeStructuredTraceQueryPath(path);
  if (Array.isArray(normalized)) {
    state.structuredRoots.add(normalized[0]);
    return normalized;
  }
  if (isStructuredCanonicalField(normalized, context)) return normalized;
  state.issues.push({
    code: 'field_not_allowed',
    path: issuePath,
    message: 'The predicate field is not allowed here',
  });
  return undefined;
}

function isStructuredCanonicalField(
  field: string,
  context: StructuredPredicateContext,
): field is TraceQueryCanonicalField {
  return Object.hasOwn(TRACE_QUERY_FIELD_REGISTRY[context], field);
}

const STRUCTURED_METADATA_RULE: StructuredFieldRule = {
  valueKind: 'scalar',
  operators: TRACE_QUERY_ORDERED_OPERATORS,
  valueSuggestions: true,
};

function getStructuredRule(
  field: StructuredTraceQueryPredicateField,
  context: StructuredPredicateContext,
  issuePath: Array<string | number>,
  state: StructuredPlannerState,
): StructuredFieldRule | undefined {
  if (Array.isArray(field)) return STRUCTURED_METADATA_RULE;
  const rules: Record<string, StructuredFieldRule> = TRACE_QUERY_FIELD_REGISTRY[context];
  const rule = rules[field];
  if (!rule) {
    state.issues.push({
      code: 'field_not_allowed',
      path: issuePath,
      message: 'The predicate field is not allowed here',
    });
  }
  return rule;
}

function normalizeStructuredLiteral(
  value: TraceQueryLiteral,
  rule: StructuredFieldRule,
  operator?: TraceQueryComparisonOperator,
): StructuredTraceQueryScalarValue | undefined {
  if (rule.valueKind === 'scalar') {
    if (operator && !TRACE_QUERY_STRING_OPERATORS.some(candidate => candidate === operator)) {
      return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
    }
    return typeof value === 'string' ||
      typeof value === 'boolean' ||
      (typeof value === 'number' && Number.isFinite(value))
      ? value
      : undefined;
  }
  if (rule.valueKind === 'number') return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
  if (rule.valueKind === 'stringOrNumber') {
    if (operator && !TRACE_QUERY_STRING_OPERATORS.some(candidate => candidate === operator)) {
      return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
    }
    return typeof value === 'string' || (typeof value === 'number' && Number.isFinite(value)) ? value : undefined;
  }
  if (rule.valueKind === 'timestamp') {
    const timestamp = structuredTimestampLiteralSchema.safeParse(value);
    return timestamp.success ? new Date(timestamp.data).toISOString() : undefined;
  }
  if (rule.valueKind === 'string' || rule.valueKind === 'array') {
    return typeof value === 'string' && (!rule.nonEmpty || value.trim().length > 0) ? value : undefined;
  }
  return undefined;
}

function normalizeStructuredSet(
  values: TraceQueryLiteral[],
  rule: StructuredFieldRule,
): StructuredTraceQueryScalarValue[] | undefined {
  const normalized = values.map(value => normalizeStructuredLiteral(value, rule));
  if (normalized.some(value => value === undefined)) return undefined;
  const defined = normalized.filter((value): value is StructuredTraceQueryScalarValue => value !== undefined);
  if (
    (rule.valueKind === 'stringOrNumber' || rule.valueKind === 'scalar') &&
    defined.some(value => typeof value !== typeof defined[0])
  ) {
    return undefined;
  }
  const unique = new Map(defined.map(value => [`${typeof value}:${JSON.stringify(value)}`, value]));
  return [...unique.values()].sort(compareStructuredScalarValues);
}

function compareStructuredScalarValues(
  left: StructuredTraceQueryScalarValue,
  right: StructuredTraceQueryScalarValue,
): number {
  if (typeof left === 'number' && typeof right === 'number') return left - right;
  if (typeof left === 'boolean' && typeof right === 'boolean') return Number(left) - Number(right);
  const leftKey = `${typeof left}:${JSON.stringify(left)}`;
  const rightKey = `${typeof right}:${JSON.stringify(right)}`;
  return compareTraceQueryStrings(leftKey, rightKey);
}

function addOperatorIssue(
  operator: string,
  field: StructuredTraceQueryPredicateField,
  path: Array<string | number>,
  state: StructuredPlannerState,
): void {
  state.issues.push({
    code: 'operator_not_allowed',
    path,
    message: `Operator ${operator} is not supported for field ${serializeStructuredTraceQueryPath(field)}`,
  });
}

function countLiteralUnits(amount: number, path: Array<string | number>, state: StructuredPlannerState): void {
  state.literalUnits += amount;
  if (state.literalUnits > TRACE_QUERY_MAX_LITERAL_UNITS) {
    state.issues.push({
      code: 'predicate_too_complex',
      path,
      message: `Trace queries are limited to ${TRACE_QUERY_MAX_LITERAL_UNITS} literal units`,
    });
  }
}

function addStructuredComplexityIssue(path: Array<string | number>, state: StructuredPlannerState): void {
  if (state.issues.some(issue => issue.code === 'predicate_too_complex')) return;
  state.issues.push({ code: 'predicate_too_complex', path, message: TRACE_QUERY_PREDICATE_COMPLEXITY_MESSAGE });
}

function addRelatedClauseIssue(path: Array<string | number>, state: StructuredPlannerState): void {
  if (state.issues.some(issue => issue.code === 'predicate_too_complex')) return;
  state.issues.push({
    code: 'predicate_too_complex',
    path,
    message: `Trace queries are limited to ${TRACE_QUERY_MAX_RELATED_CLAUSES} related collection clauses`,
  });
}

function normalizeTimeRange(timeRange: { from: string; to: string }): { from: string; to: string } {
  return { from: new Date(timeRange.from).toISOString(), to: new Date(timeRange.to).toISOString() };
}

function validateTimeRange(from: Date, to: Date, path: Array<string | number>, issues: TraceQueryIssue[]): void {
  if (from >= to) {
    issues.push({ code: 'invalid_time_range', path, message: '`from` must be earlier than `to`' });
  } else if (to.getTime() - from.getTime() > 31 * 24 * 60 * 60 * 1000) {
    issues.push({ code: 'time_range_too_large', path, message: 'The time range cannot exceed 31 days' });
  }
}

function normalizeTenantScope(scope: TraceQueryTenantScope | undefined): TraceQueryTenantScope | undefined {
  if (!scope) return undefined;
  return scope.resourceId === undefined
    ? { organizationId: scope.organizationId }
    : { organizationId: scope.organizationId, resourceId: scope.resourceId };
}

function sortedStructuredRoots(roots: Set<StructuredTraceQueryRoot>): StructuredTraceQueryRoot[] {
  return [...roots].sort(compareTraceQueryStrings);
}

function formatStructuredSchemaIssues(error: z.ZodError): TraceQueryIssue[] {
  return error.issues.map(issue => {
    const customCode =
      issue.code === 'custom' && issue.message === TRACE_QUERY_PREDICATE_COMPLEXITY_MESSAGE
        ? 'predicate_too_complex'
        : issue.code === 'custom' && issue.message === PAGINATION_MODE_CONFLICT_MESSAGE
          ? 'pagination_mode_conflict'
          : issue.code === 'custom' && issue.message === GROUP_PAGINATION_NOT_SUPPORTED_MESSAGE
            ? 'group_pagination_not_supported'
            : undefined;
    return {
      code: customCode ?? 'invalid_request',
      path: issue.path.map(part => (typeof part === 'symbol' ? String(part) : part)),
      message: customCode ? issue.message : 'The value does not match the structured trace-query request contract',
    };
  });
}

function findStructuredPredicateComplexityIssue(
  input: unknown,
  roots: Array<Array<string | number>>,
): Array<string | number> | undefined {
  let nodes = 0;
  const visit = (value: unknown, path: Array<string | number>, depth: number): Array<string | number> | undefined => {
    if (!isRecord(value)) return undefined;
    nodes += 1;
    if (depth > TRACE_QUERY_MAX_DEPTH || nodes > TRACE_QUERY_MAX_NODES) return path;
    if ((value.op === 'and' || value.op === 'or') && Array.isArray(value.args)) {
      for (let index = 0; index < value.args.length; index += 1) {
        const issue = visit(value.args[index], [...path, 'args', index], depth + 1);
        if (issue) return issue;
      }
    } else if (value.op === 'not') {
      return visit(value.arg, [...path, 'arg'], depth + 1);
    } else {
      for (const collection of ['traces', 'spans', 'scores', 'feedback'] as const) {
        const relation = value[collection];
        if (!isRecord(relation)) continue;
        const quantifier = 'some' in relation ? 'some' : 'none';
        return visit(relation[quantifier], [...path, collection, quantifier], depth + 1);
      }
    }
    return undefined;
  };

  for (const root of roots) {
    let value = input;
    for (const part of root) {
      if (!isRecord(value)) {
        value = undefined;
        break;
      }
      value = value[part];
    }
    if (value === undefined) continue;
    const issue = visit(value, root, 1);
    if (issue) return issue;
  }
  return undefined;
}

const structuredCursorEnvelopeSchema = z
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

function decodeStructuredCursor(
  cursor: string,
  expectedResult: StructuredTraceQueryCursorValues['result'],
  expectedBinding: string,
): StructuredTraceQueryCursorValues {
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
  } catch {
    throw new TraceQueryCursorError('TRACE_QUERY_CURSOR_MALFORMED');
  }
  const envelope = structuredCursorEnvelopeSchema.safeParse(parsed);
  if (!envelope.success) throw new TraceQueryCursorError('TRACE_QUERY_CURSOR_MALFORMED');
  if (envelope.data.binding !== expectedBinding || envelope.data.values.result !== expectedResult) {
    throw new TraceQueryCursorError('TRACE_QUERY_CURSOR_CONFLICT');
  }
  return envelope.data.values;
}

function decodeStructuredDeltaCursor(cursor: string, binding: string): { adapter: string; watermark: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
  } catch {
    throw new TraceQueryCursorError('TRACE_QUERY_CURSOR_MALFORMED');
  }
  const envelope = structuredDeltaCursorEnvelopeSchema.safeParse(parsed);
  if (!envelope.success) throw new TraceQueryCursorError('TRACE_QUERY_CURSOR_MALFORMED');
  if (envelope.data.binding !== binding) throw new TraceQueryCursorError('TRACE_QUERY_CURSOR_CONFLICT');
  return { adapter: envelope.data.adapter, watermark: envelope.data.watermark };
}

function digestStructuredBinding(value: unknown): string {
  return createHash('sha256').update(stableStructuredStringify(value)).digest('hex');
}

function stableStructuredStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStructuredStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value)
      .filter(([, nested]) => nested !== undefined)
      .sort(([left], [right]) => compareTraceQueryStrings(left, right))
      .map(([key, nested]) => `${JSON.stringify(key)}:${stableStructuredStringify(nested)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}
