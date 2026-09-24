import { expectTypeOf, test } from 'vitest';
import { ObservabilityStorage } from './base';
import type { ObservabilityStorageFeature } from './base';
import {
  supportsStructuredThreadQueryExecution,
  supportsStructuredTraceQueryDiscovery,
  supportsStructuredTraceQueryExecution,
} from './structured-trace-query';
import type {
  GetStructuredTraceQueryFieldsResponse,
  GetStructuredTraceQueryValuesResponse,
  StructuredThreadQueryExecutionStorage,
  StructuredTraceQueryDiscoveryStorage,
  StructuredTraceQueryExecutionStorage,
  StructuredTraceQueryPath,
  TrustedStructuredThreadQueryPlan,
  TrustedStructuredTraceQueryObservedFieldsPlan,
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

test('structured paths and discovery values retain their distinct types', () => {
  const canonical: StructuredTraceQueryPath = 'metadata.customer.plan';
  const exact: StructuredTraceQueryPath = ['metadata', 'customer.plan'];
  // @ts-expect-error Structured tuples only support the metadata root.
  const invalidRoot: StructuredTraceQueryPath = ['attributes', 'customer.plan'];
  // @ts-expect-error Structured tuples require at least one post-root segment.
  const emptyTuple: StructuredTraceQueryPath = ['metadata'];

  expectTypeOf(canonical).toExtend<StructuredTraceQueryPath>();
  expectTypeOf(exact).toExtend<StructuredTraceQueryPath>();
  expectTypeOf(invalidRoot).toExtend<StructuredTraceQueryPath>();
  expectTypeOf(emptyTuple).toExtend<StructuredTraceQueryPath>();
  expectTypeOf<GetStructuredTraceQueryValuesResponse['values'][number]['value']>().toEqualTypeOf<
    string | number | boolean
  >();
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

  expectTypeOf<TraceGuard>().toEqualTypeOf<ObservabilityStorage>();
  expectTypeOf<ThreadGuard>().toEqualTypeOf<ObservabilityStorage>();
  expectTypeOf<DiscoveryGuard>().toEqualTypeOf<ObservabilityStorage>();
  expectTypeOf<TraceOnly>().not.toExtend<StructuredThreadQueryExecutionStorage>();
  expectTypeOf<TraceOnly>().not.toExtend<StructuredTraceQueryDiscoveryStorage>();

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
