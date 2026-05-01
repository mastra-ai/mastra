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
 * Fetches all scores for an agent filtered by scorer, paginating until
 * every page has been consumed, then indexes them by traceId.
 */
export function useAgentTraceScores({ agentId, scorerId, enabled }: UseAgentTraceScoresParams) {
  const client = useMastraClient();

  const { data: allScores, isLoading } = useQuery({
    queryKey: ['agent-trace-scores', agentId, scorerId],
    queryFn: async () => {
      const perPage = 100;
      let page = 0;
      const scores: ScoreRecord[] = [];

      while (true) {
        const res = await client.listScores({
          filters: {
            entityType: EntityType.AGENT,
            entityName: agentId,
            ...(scorerId && { scorerId }),
          },
          pagination: { page, perPage },
          orderBy: { field: 'score', direction: 'ASC' },
        });

        scores.push(...(res?.scores ?? []));
        if (!res?.pagination?.hasMore) break;
        page++;
      }

      return scores;
    },
    enabled: enabled && Boolean(scorerId),
    refetchInterval: 10_000,
  });

  const scoresByTraceId = useMemo(() => {
    const map = new Map<string, ScoreRecord[]>();
    if (!allScores) return map;

    for (const score of allScores) {
      if (!score.traceId) {
        continue;
      }

      const existing = map.get(score.traceId);
      if (existing) {
        existing.push(score);
      } else {
        map.set(score.traceId, [score]);
      }
    }
    return map;
  }, [allScores]);

  return { scoresByTraceId, isLoading };
}
