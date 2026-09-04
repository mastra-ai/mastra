import { buildThreadRailTurns } from '@mastra/playground-ui/components/ThreadRail';
import type { ThreadRailTurn } from '@mastra/playground-ui/components/ThreadRail';
import { traceSpansQueryOptions } from '@mastra/playground-ui/domains/traces/hooks/use-trace-spans';
import { useMastraClient } from '@mastra/react';
import { useQueries } from '@tanstack/react-query';

import { formatTraceThreadMessages } from '@/domains/traces/components/format-trace-thread-messages';

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

  return useQueries({
    queries: traceIds.map(traceId => ({
      ...traceSpansQueryOptions(client, traceId),
      select: (data: Awaited<ReturnType<typeof client.getTrace>>): ThreadRailTurn => {
        const [turn] = buildThreadRailTurns(formatTraceThreadMessages(data?.spans ?? []));
        return turn ? { ...turn, key: traceId, messageId: traceId } : fallbackRailTurn(traceId);
      },
    })),
    combine: results => results.map((result, index) => result.data ?? fallbackRailTurn(traceIds[index]!)),
  });
}
