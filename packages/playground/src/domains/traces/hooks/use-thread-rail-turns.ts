import { buildThreadRailTurns } from '@mastra/playground-ui/components/ThreadRail';
import type { ThreadRailTurn } from '@mastra/playground-ui/components/ThreadRail';
import { useTraceSpansQueries } from '@mastra/playground-ui/domains/traces/hooks/use-trace-spans';
import type { TraceSpansData } from '@mastra/playground-ui/domains/traces/hooks/use-trace-spans';

import { formatTraceThreadMessages } from '@/domains/traces/components/format-trace-thread-messages';

export const fallbackRailTurn = (traceId: string): ThreadRailTurn => ({
  key: traceId,
  messageId: traceId,
  prompt: 'Agent turn',
  files: [],
  hiddenFileCount: 0,
});

const selectRailTurn = (traceId: string, data: TraceSpansData): ThreadRailTurn => {
  const [turn] = buildThreadRailTurns(formatTraceThreadMessages(data?.spans ?? []));
  return turn ? { ...turn, key: traceId, messageId: traceId } : fallbackRailTurn(traceId);
};

/**
 * One rail stop per trace, summarised from the turn its spans reconstruct. Shares the
 * `trace-spans` query (options included, so the two observers agree on freshness); the stop is keyed by the
 * trace id so the rail can track rows rather than message ids.
 */
export function useThreadRailTurns(traceIds: string[]): ThreadRailTurn[] {
  return useTraceSpansQueries(traceIds, selectRailTurn, fallbackRailTurn);
}
