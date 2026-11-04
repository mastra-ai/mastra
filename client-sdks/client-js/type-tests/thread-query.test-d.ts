import type { QueryThreadsResult, ThreadQueryResponse } from '@mastra/core/storage';
import { expectTypeOf, test } from 'vitest';
import type { MastraClient } from '../src/client';
import type { Observability } from '../src/resources/observability';

declare const client: MastraClient;
declare const observability: Observability;

test('infers thread rows or legacy identities from the request at both client entry points', () => {
  const timeRange = { from: '2026-08-01T00:00:00Z', to: '2026-09-01T00:00:00Z' };
  for (const api of [client, observability]) {
    const threads = api.queryTraceThreads({ timeRange: { traces: timeRange } });
    expectTypeOf(threads).toEqualTypeOf<Promise<ThreadQueryResponse>>();
    expectTypeOf<Awaited<typeof threads>['threads'][number]['firstTraceId']>().toEqualTypeOf<string>();
    expectTypeOf<Awaited<typeof threads>['threads'][number]['traceCount']>().toEqualTypeOf<number>();
    expectTypeOf<Awaited<typeof threads>['page']['next']>().toEqualTypeOf<string | null>();
    expectTypeOf(api.queryTraceThreads({ traces: { timeRange } })).toEqualTypeOf<Promise<QueryThreadsResult>>();
  }
});
