import type { MastraClient } from '@mastra/client-js';
import { useMastraClient } from '@mastra/react';
import { queryOptions, useQueries, useQuery } from '@tanstack/react-query';
import type { UseQueryResult } from '@tanstack/react-query';
import type { SearchableSpan } from '../types';
import { selectSearchableSpans } from '../utils';

const IMMUTABLE_CACHE_TIME = 1000 * 60 * 60 * 24 * 30; // 30 days, massive cache, span data is immutable

/**
 * Key, fetcher and stale policy of the `trace-spans` query. Every observer of this key must
 * share these (rather than only the key) so one observer with a stricter `staleTime` does not
 * refetch data another one considers fresh.
 */
export const traceSpansQueryOptions = (client: MastraClient, traceId: string | null | undefined) =>
  queryOptions({
    queryKey: ['trace-spans', traceId],
    queryFn: async () => {
      if (!traceId) {
        throw new Error('Trace ID is required');
      }
      const res = await client.getTrace(traceId);
      return res;
    },
    enabled: !!traceId,
    staleTime: query => {
      const data = query.state.data;
      const isFinished = data?.spans.every(span => Boolean(span.endedAt));
      return isFinished ? IMMUTABLE_CACHE_TIME : 0;
    },
  });

/**
 * Every span of a single trace, with its full payload.
 *
 * The lightweight projection exists to keep blob columns off the read path of a
 * *list*, where the cost is paid once per trace on screen. A trace that is open
 * has already narrowed that to one, and the panel both renders and searches
 * these spans -- `input`, `output` and `attributes` included -- so the
 * projection would only hide content the reader is looking at.
 */
export function useTraceSpans(
  traceId: string | null | undefined,
): UseQueryResult<{ traceId: string; spans: SearchableSpan[] } | null> {
  const client = useMastraClient();

  return useQuery({
    ...traceSpansQueryOptions(client, traceId),
    // Builds each span's search haystack once per fetch, cached with the query.
    select: selectSearchableSpans,
  });
}

export type TraceSpansData = Awaited<ReturnType<MastraClient['getTrace']>>;

/**
 * Observes the `trace-spans` query of several traces at once and projects each one with `select`.
 * Traces still loading (or failed) yield `fallback(traceId)` so the result always lines up with `traceIds`.
 */
export function useTraceSpansQueries<T>(
  traceIds: string[],
  select: (traceId: string, data: TraceSpansData) => T,
  fallback: (traceId: string) => T,
): T[] {
  const client = useMastraClient();

  return useQueries({
    queries: traceIds.map(traceId => ({
      ...traceSpansQueryOptions(client, traceId),
      select: (data: TraceSpansData) => select(traceId, data),
    })),
    combine: results =>
      results.map((result, index) =>
        result.data === undefined ? fallback(traceIds[index] ?? '') : (result.data as T),
      ),
  });
}
