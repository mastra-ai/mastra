import type { MastraClient } from '@mastra/client-js';
import { buildThreadRailTurns } from '@mastra/playground-ui/components/ThreadRail';
import type { ThreadRailTurn } from '@mastra/playground-ui/components/ThreadRail';
import { traceSpansQueryOptions } from '@mastra/playground-ui/domains/traces/hooks/use-trace-spans';
import { useMastraClient } from '@mastra/react';
import { useQueries } from '@tanstack/react-query';
import type { UseQueryOptions } from '@tanstack/react-query';

import { formatTraceThreadMessages } from '@/domains/traces/components/format-trace-thread-messages';

type TraceSpansData = Awaited<ReturnType<MastraClient['getTrace']>>;
type TraceSpansQueryKey = ReturnType<typeof traceSpansQueryOptions>['queryKey'];

export const fallbackRailTurn = (traceId: string): ThreadRailTurn => ({
  key: traceId,
  messageId: traceId,
  prompt: 'Agent turn',
  files: [],
  hiddenFileCount: 0,
});

/**
 * One rail stop per trace, summarised from the turn its spans reconstruct. Shares the
 * `trace-spans` query (options included, so the two observers agree on freshness); the stop is keyed by the
 * trace id so the rail can track rows rather than message ids.
 */
export function useThreadRailTurns(traceIds: string[]): ThreadRailTurn[] {
  const client = useMastraClient();

  const queries = traceIds.map(
    (traceId): UseQueryOptions<TraceSpansData, Error, ThreadRailTurn, TraceSpansQueryKey> => {
      const { queryKey, queryFn, enabled, staleTime, gcTime } = traceSpansQueryOptions(client, traceId);
      return {
        queryKey,
        queryFn,
        enabled,
        staleTime,
        gcTime,
        select: data => {
          const [turn] = buildThreadRailTurns(formatTraceThreadMessages(data?.spans ?? []));
          return turn ? { ...turn, key: traceId, messageId: traceId } : fallbackRailTurn(traceId);
        },
      };
    },
  );

  return useQueries({
    queries,
    combine: (results): ThreadRailTurn[] =>
      results.map((result, index) => result.data ?? fallbackRailTurn(traceIds[index]!)),
  });
}
