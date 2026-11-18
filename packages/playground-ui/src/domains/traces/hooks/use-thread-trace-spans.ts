import { useMastraClient } from '@mastra/react';
import { traceSpansQueryOptions } from '@mastra/react/hooks/traces';
import { useQueries } from '@tanstack/react-query';
import type { ThreadViewTrace } from '../components/thread-view-by-trace-view';

/**
 * The spans of each trace of a thread, through the shared `trace-spans` cache, lined up with `traceIds`.
 * Passive like the rows they back: each trace loads once, and refreshes are left to the open span's trace.
 */
export function useThreadTraceSpans(traceIds: string[]): ThreadViewTrace[] {
  const client = useMastraClient();

  return useQueries({
    queries: traceIds.map(traceId => ({
      ...traceSpansQueryOptions(client, traceId),
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    })),
    combine: results =>
      traceIds.map((traceId, index) => {
        const result = results[index];
        return {
          traceId,
          spans: result?.data?.spans,
          isLoading: result?.isLoading ?? true,
          error: result?.error ?? undefined,
        };
      }),
  });
}
