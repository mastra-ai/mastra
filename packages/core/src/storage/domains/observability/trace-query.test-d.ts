import { expectTypeOf, test } from 'vitest';
import { ObservabilityStorage } from './base';
import type { ObservabilityStorageFeature } from './base';
import {
  encodeStructuredTraceQueryCursor,
  encodeStructuredTraceQueryDeltaCursor,
  supportsStructuredThreadQueryExecution,
  supportsStructuredTraceQueryDiscovery,
  supportsStructuredTraceQueryExecution,
} from './structured-trace-query';
import type {
  GetStructuredTraceQueryFieldsResponse,
  GetStructuredTraceQueryValuesResponse,
  StructuredThreadQueryExecutionStorage,
  StructuredTraceQueryCapabilities,
  StructuredTraceQueryCapabilityReporter,
  StructuredTraceQueryDiscoveryStorage,
  StructuredTraceQueryExecutionStorage,
  StructuredTraceQueryOperationCapability,
  StructuredTraceQueryPath,
  StructuredTraceQueryRequest,
  StructuredTraceQueryRoot,
  TrustedStructuredThreadQueryPlan,
  TrustedStructuredTraceQueryDeltaTracesPlan,
  TrustedStructuredTraceQueryGroupsPlan,
  TrustedStructuredTraceQueryKeysetTracesPlan,
  TrustedStructuredTraceQueryObservedFieldsPlan,
  TrustedStructuredTraceQueryPaginatedTracesPlan,
  TrustedStructuredTraceQueryPlan,
  TrustedStructuredTraceQueryValuesPlan,
} from './structured-trace-query';
import { encodeTraceQueryDeltaCursor } from './trace-query';
import type {
  GetTraceQueryFieldsResponse,
  GetTraceQueryValuesResponse,
  ThreadPredicate,
  TraceQueryObservedFieldDescriptor,
  TraceQueryPathOrLiteral,
  TraceQueryPredicate,
  TraceQueryScalarPredicate,
  TrustedThreadQueryPlan,
  TrustedTraceQueryDeltaTracesPlan,
  TrustedTraceQueryGroupsPlan,
  TrustedTraceQueryKeysetTracesPlan,
  TrustedTraceQueryObservedFieldsPlan,
  TrustedTraceQueryPaginatedTracesPlan,
  TrustedTraceQueryPlan,
  TrustedTraceQueryPredicate,
  TrustedTraceQueryValuesPlan,
} from './trace-query';

test('delta cursors accept only numbered-page and delta trace plans', () => {
  type CursorPlan = Parameters<typeof encodeTraceQueryDeltaCursor>[0];
  expectTypeOf<CursorPlan>().toEqualTypeOf<TrustedTraceQueryPaginatedTracesPlan | TrustedTraceQueryDeltaTracesPlan>();
  expectTypeOf<TrustedTraceQueryKeysetTracesPlan>().not.toExtend<CursorPlan>();
  expectTypeOf<TrustedTraceQueryGroupsPlan>().not.toExtend<CursorPlan>();
  expectTypeOf<TrustedThreadQueryPlan>().not.toExtend<CursorPlan>();
});

test('structured cursor encoders accept only their intended trusted plans', () => {
  type CursorPlan = Parameters<typeof encodeStructuredTraceQueryCursor>[0];
  type DeltaCursorPlan = Parameters<typeof encodeStructuredTraceQueryDeltaCursor>[0];

  expectTypeOf<CursorPlan>().toEqualTypeOf<
    | TrustedStructuredTraceQueryKeysetTracesPlan
    | TrustedStructuredTraceQueryGroupsPlan
    | TrustedStructuredThreadQueryPlan
  >();
  expectTypeOf<TrustedStructuredTraceQueryPaginatedTracesPlan>().not.toExtend<CursorPlan>();
  expectTypeOf<TrustedStructuredTraceQueryDeltaTracesPlan>().not.toExtend<CursorPlan>();
  expectTypeOf<DeltaCursorPlan>().toEqualTypeOf<
    TrustedStructuredTraceQueryPaginatedTracesPlan | TrustedStructuredTraceQueryDeltaTracesPlan
  >();
  expectTypeOf<TrustedStructuredTraceQueryKeysetTracesPlan>().not.toExtend<DeltaCursorPlan>();
  expectTypeOf<TrustedStructuredTraceQueryGroupsPlan>().not.toExtend<DeltaCursorPlan>();
  expectTypeOf<TrustedStructuredThreadQueryPlan>().not.toExtend<DeltaCursorPlan>();
});

test('legacy trace-query paths and discovery values retain their released types', () => {
  type PathReference = Extract<TraceQueryPathOrLiteral, { path: string }>;
  type Comparison = Extract<TraceQueryScalarPredicate, { left: TraceQueryPathOrLiteral }>;
  type Presence = Extract<TraceQueryScalarPredicate, { path: string }>;

  expectTypeOf<PathReference['path']>().toEqualTypeOf<string>();
  expectTypeOf<Comparison['left']>().toEqualTypeOf<TraceQueryPathOrLiteral>();
  expectTypeOf<Presence['path']>().toEqualTypeOf<string>();
  expectTypeOf<TraceQueryObservedFieldDescriptor['path']>().toEqualTypeOf<`metadata.${string}`>();
  expectTypeOf<TraceQueryObservedFieldDescriptor['valueKind']>().toEqualTypeOf<'string'>();
  expectTypeOf<GetTraceQueryValuesResponse['values'][number]['value']>().toEqualTypeOf<string>();
  expectTypeOf<TrustedTraceQueryObservedFieldsPlan>().not.toHaveProperty('structuredRoots');
  expectTypeOf<TrustedTraceQueryValuesPlan['path']>().toEqualTypeOf<string>();
});

test('legacy thread queries and storage features retain their released types', () => {
  type TraceRelation = Extract<ThreadPredicate, { traces: unknown }>;
  type Features =
    | 'delta-polling'
    | 'metrics'
    | 'logs'
    | 'trace-query'
    | 'trace-query-root-duration'
    | 'trace-query-discovery'
    | 'thread-query'
    | 'trace-query-tenant-scope';

  expectTypeOf<TraceRelation['traces']>().toEqualTypeOf<
    { some: TraceQueryPredicate } | { none: TraceQueryPredicate }
  >();
  expectTypeOf<TrustedThreadQueryPlan['traces']['where']>().toEqualTypeOf<TrustedTraceQueryPredicate | undefined>();
  expectTypeOf<ObservabilityStorageFeature>().toEqualTypeOf<Features>();
  expectTypeOf<ReturnType<ObservabilityStorage['getFeatures']>>().toEqualTypeOf<
    readonly ObservabilityStorageFeature[] | undefined
  >();
});

test('structured paths, grouping, and discovery values retain their distinct types', () => {
  const canonical: StructuredTraceQueryPath = 'metadata.customer.plan';
  const exact: StructuredTraceQueryPath = ['metadata', 'customer.plan'];
  const groupedRequest = {
    timeRange: { from: '2026-08-01T00:00:00Z', to: '2026-09-01T00:00:00Z' },
    group: { by: ['threadId'] as ['threadId'] },
  } satisfies StructuredTraceQueryRequest;
  // @ts-expect-error Structured tuples only support the metadata root.
  const invalidRoot: StructuredTraceQueryPath = ['attributes', 'customer.plan'];
  // @ts-expect-error Structured tuples require at least one post-root segment.
  const emptyTuple: StructuredTraceQueryPath = ['metadata'];

  expectTypeOf(canonical).toExtend<StructuredTraceQueryPath>();
  expectTypeOf(exact).toExtend<StructuredTraceQueryPath>();
  expectTypeOf(groupedRequest).toExtend<StructuredTraceQueryRequest>();
  expectTypeOf(invalidRoot).toExtend<StructuredTraceQueryPath>();
  expectTypeOf(emptyTuple).toExtend<StructuredTraceQueryPath>();
  expectTypeOf<GetStructuredTraceQueryValuesResponse['values'][number]['value']>().toEqualTypeOf<
    string | number | boolean
  >();
});

test('structured capabilities advertise operation-specific roots', () => {
  const traceCapabilities = {
    traces: { roots: ['metadata'] },
  } as const satisfies StructuredTraceQueryCapabilities;
  const operationCapability = { roots: ['metadata'] } as const satisfies StructuredTraceQueryOperationCapability;
  // @ts-expect-error Input is not a structured root in the current contract.
  const unsupportedCapability: StructuredTraceQueryOperationCapability = { roots: ['input'] };

  expectTypeOf<StructuredTraceQueryOperationCapability['roots']>().toEqualTypeOf<readonly StructuredTraceQueryRoot[]>();
  expectTypeOf(traceCapabilities.traces.roots).toEqualTypeOf<readonly ['metadata']>();
  expectTypeOf(operationCapability.roots).toEqualTypeOf<readonly ['metadata']>();
  expectTypeOf(unsupportedCapability).toExtend<StructuredTraceQueryOperationCapability>();
});

test('legacy and structured trusted contracts are not interchangeable', () => {
  expectTypeOf<TrustedStructuredTraceQueryPlan>().not.toExtend<TrustedTraceQueryPlan>();
  expectTypeOf<TrustedTraceQueryPlan>().not.toExtend<TrustedStructuredTraceQueryPlan>();
  expectTypeOf<TrustedStructuredThreadQueryPlan>().not.toExtend<TrustedThreadQueryPlan>();
  expectTypeOf<TrustedThreadQueryPlan>().not.toExtend<TrustedStructuredThreadQueryPlan>();
  expectTypeOf<TrustedTraceQueryObservedFieldsPlan>().not.toExtend<TrustedStructuredTraceQueryObservedFieldsPlan>();
  expectTypeOf<TrustedStructuredTraceQueryValuesPlan>().not.toExtend<TrustedTraceQueryValuesPlan>();
  expectTypeOf<GetStructuredTraceQueryFieldsResponse>().not.toExtend<GetTraceQueryFieldsResponse>();
  expectTypeOf<GetStructuredTraceQueryValuesResponse>().not.toExtend<GetTraceQueryValuesResponse>();
});

test('structured capability guards narrow independently without changing the base class', () => {
  class ThirdPartyLegacyStorage extends ObservabilityStorage {}
  expectTypeOf<ThirdPartyLegacyStorage>().toExtend<ObservabilityStorage>();
  expectTypeOf<ThirdPartyLegacyStorage>().not.toExtend<StructuredTraceQueryExecutionStorage>();

  type TraceGuard = Parameters<typeof supportsStructuredTraceQueryExecution>[0];
  type ThreadGuard = Parameters<typeof supportsStructuredThreadQueryExecution>[0];
  type DiscoveryGuard = Parameters<typeof supportsStructuredTraceQueryDiscovery>[0];
  type TraceOnly = ObservabilityStorage & StructuredTraceQueryExecutionStorage;
  type ThreadOnly = ObservabilityStorage & StructuredThreadQueryExecutionStorage;
  type DiscoveryOnly = ObservabilityStorage & StructuredTraceQueryDiscoveryStorage;
  type PartialDiscovery = ObservabilityStorage &
    StructuredTraceQueryCapabilityReporter &
    Pick<StructuredTraceQueryDiscoveryStorage, 'getStructuredTraceQueryObservedFields'>;

  expectTypeOf<TraceGuard>().toEqualTypeOf<ObservabilityStorage>();
  expectTypeOf<ThreadGuard>().toEqualTypeOf<ObservabilityStorage>();
  expectTypeOf<DiscoveryGuard>().toEqualTypeOf<ObservabilityStorage>();
  expectTypeOf<
    ReturnType<StructuredTraceQueryCapabilityReporter['getStructuredTraceQueryCapabilities']>
  >().toEqualTypeOf<StructuredTraceQueryCapabilities>();
  expectTypeOf<TraceOnly>().not.toExtend<StructuredThreadQueryExecutionStorage>();
  expectTypeOf<TraceOnly>().not.toExtend<StructuredTraceQueryDiscoveryStorage>();
  expectTypeOf<ThreadOnly>().not.toExtend<StructuredTraceQueryExecutionStorage>();
  expectTypeOf<ThreadOnly>().not.toExtend<StructuredTraceQueryDiscoveryStorage>();
  expectTypeOf<DiscoveryOnly>().not.toExtend<StructuredTraceQueryExecutionStorage>();
  expectTypeOf<DiscoveryOnly>().not.toExtend<StructuredThreadQueryExecutionStorage>();
  expectTypeOf<PartialDiscovery>().not.toExtend<StructuredTraceQueryDiscoveryStorage>();

  const storage: ObservabilityStorage = new ObservabilityStorage();
  if (supportsStructuredTraceQueryExecution(storage)) {
    expectTypeOf(storage).toEqualTypeOf<ObservabilityStorage & StructuredTraceQueryExecutionStorage>();
  }
  if (supportsStructuredThreadQueryExecution(storage)) {
    expectTypeOf(storage).toEqualTypeOf<ObservabilityStorage & StructuredThreadQueryExecutionStorage>();
  }
  if (supportsStructuredTraceQueryDiscovery(storage)) {
    expectTypeOf(storage).toEqualTypeOf<ObservabilityStorage & StructuredTraceQueryDiscoveryStorage>();
  }
});
