import { EntityType } from '@mastra/core/observability';
import type { ScoreRecord } from '@mastra/core/storage';
import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

type UseAgentTraceScoresParams = {
  agentId: string;
  scorerId: string | undefined;
  enabled: boolean;
};

/**
 * Fetches scores for an agent filtered by scorer, then indexes them by traceId.
 * Used to enrich trace rows with score values when a scorer filter is active.
 */
export function useAgentTraceScores({ agentId, scorerId, enabled }: UseAgentTraceScoresParams) {
  const client = useMastraClient();

  const { data: scoresData, isLoading } = useQuery({
    queryKey: ['agent-trace-scores', agentId, scorerId],
    queryFn: () =>
      client.listScores({
        filters: {
          entityType: EntityType.AGENT,
          entityName: agentId,
          ...(scorerId && { scorerId }),
        },
        pagination: { page: 0, perPage: 100 },
        orderBy: { field: 'score', direction: 'ASC' },
      }),
    enabled: enabled && Boolean(scorerId),
    refetchInterval: 10_000,
  });

  const scoresByTraceId = useMemo(() => {
    const map = new Map<string, ScoreRecord[]>();
    if (!scoresData?.scores) return map;

    for (const score of scoresData.scores) {
      const existing = map.get(score.traceId);
      if (existing) {
        existing.push(score);
      } else {
        map.set(score.traceId, [score]);
      }
    }
    return map;
  }, [scoresData?.scores]);

  return { scoresByTraceId, isLoading };
}
