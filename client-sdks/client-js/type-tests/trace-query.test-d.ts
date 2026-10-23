import type {
  TraceQueryDeltaTraceResponse,
  TraceQueryPaginatedTraceResponse,
  TraceQueryTraceResponse,
} from '@mastra/core/storage';
import { expectTypeOf } from 'vitest';
import type { MastraClient, QueryTracesInput } from '../src/index.js';
import type { Observability } from '../src/resources/observability.js';

declare const client: MastraClient;
declare const observability: Observability;
declare const genericInput: QueryTracesInput;
const timeRange = { from: '2026-08-01T00:00:00Z', to: '2026-09-01T00:00:00Z' };

// Equality prevents the shared assertions from hiding a regression in only one entry point.
expectTypeOf(client.queryTraces).toEqualTypeOf(observability.queryTraces);
expectTypeOf(client.queryTraceThreads).toEqualTypeOf(observability.queryTraceThreads);

// Both public entry points must retain all overloads, including the union fallback.
for (const api of [client, observability]) {
  const keyset = api.queryTraces({ timeRange, page: { limit: 25 } });
  expectTypeOf(keyset).toEqualTypeOf<Promise<TraceQueryTraceResponse>>();
  expectTypeOf(api.queryTraces({ timeRange })).toEqualTypeOf<Promise<TraceQueryTraceResponse>>();
  const numbered = api.queryTraces({ timeRange, pagination: { page: 0, perPage: 25 } });
  expectTypeOf(numbered).toEqualTypeOf<Promise<TraceQueryPaginatedTraceResponse>>();
  const delta = api.queryTraces({ timeRange, mode: 'delta', after: 'cursor', limit: 25 });
  expectTypeOf(delta).toEqualTypeOf<Promise<TraceQueryDeltaTraceResponse>>();
  expectTypeOf<Awaited<typeof delta>['deltaCursor']>().toEqualTypeOf<string>();
  expectTypeOf<Awaited<typeof delta>['delta']['hasMore']>().toEqualTypeOf<boolean>();
  expectTypeOf(api.queryTraces(genericInput)).toEqualTypeOf<
    Promise<TraceQueryTraceResponse | TraceQueryPaginatedTraceResponse | TraceQueryDeltaTraceResponse>
  >();

  // @ts-expect-error Keyset and numbered-page modes are mutually exclusive.
  void api.queryTraces({ timeRange, page: { limit: 25 }, pagination: { page: 0 } });
  // @ts-expect-error Delta does not accept keyset pagination.
  void api.queryTraces({ timeRange, mode: 'delta', page: { limit: 25 } });
  // @ts-expect-error Delta does not accept numbered-page pagination.
  void api.queryTraces({ timeRange, mode: 'delta', pagination: { page: 0 } });
  // @ts-expect-error after is delta-only at the top level.
  void api.queryTraces({ timeRange, after: 'cursor' });
  // @ts-expect-error limit is delta-only at the top level.
  void api.queryTraces({ timeRange, limit: 25 });
  // @ts-expect-error Delta has a fixed ordering.
  void api.queryTraces({ timeRange, mode: 'delta', orderBy: [] });
  // @ts-expect-error The SDK trace endpoint excludes grouped queries.
  void api.queryTraces({ timeRange, group: { by: ['threadId'] } });
  // @ts-expect-error Delta cannot be combined with grouped queries.
  void api.queryTraces({ timeRange, mode: 'delta', group: { by: ['threadId'] } });
  // @ts-expect-error Thread queries do not support delta mode.
  void api.queryTraceThreads({ traces: { timeRange }, mode: 'delta' });
  // @ts-expect-error Delta-only cursor is not a thread-query option.
  void api.queryTraceThreads({ traces: { timeRange }, after: 'cursor' });
}
