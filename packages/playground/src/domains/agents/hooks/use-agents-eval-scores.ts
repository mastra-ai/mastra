import type { MastraClient } from '@mastra/client-js';
import { EntityType } from '@mastra/core/observability';
import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';
import { previousWindow } from '@/domains/overview/overview-period';
import type { PeriodWindow } from '@/domains/overview/overview-period';

export interface ScorerAverage {
  scorerName: string;
  average: number;
  previousAverage: number | null;
}

export interface AgentEvalScores {
  average: number;
  byScorer: ScorerAverage[];
}

function averagesByAgentId(client: MastraClient, scorerId: string, timestamp: PeriodWindow) {
  return client
    .getScoreBreakdown({
      scorerId,
      aggregation: 'avg',
      groupBy: ['entityId'],
      filters: { timestamp, entityType: EntityType.AGENT },
    })
    .then(response => new Map(response.groups.map(group => [group.dimensions.entityId, group.value])));
}

async function fetchAgentsEvalScores(client: MastraClient, window: PeriodWindow) {
  const scorers = Object.entries(await client.listScorers());
  const perScorer = await Promise.all(
    scorers.map(async ([scorerId, scorer]) => {
      const [current, previous] = await Promise.all([
        averagesByAgentId(client, scorerId, window),
        averagesByAgentId(client, scorerId, previousWindow(window)),
      ]);
      return { scorerName: scorer.scorer.config?.name || scorerId, current, previous };
    }),
  );

  const byAgentId = new Map<string, AgentEvalScores>();
  for (const { scorerName, current, previous } of perScorer) {
    for (const [agentId, average] of current) {
      if (!agentId) continue;
      const scores = byAgentId.get(agentId) ?? { average: 0, byScorer: [] };
      scores.byScorer.push({ scorerName, average, previousAverage: previous.get(agentId) ?? null });
      byAgentId.set(agentId, scores);
    }
  }
  for (const scores of byAgentId.values()) {
    scores.average = scores.byScorer.reduce((sum, scorer) => sum + scorer.average, 0) / scores.byScorer.length;
  }
  return byAgentId;
}

export function useAgentsEvalScores({
  window,
  windowKey,
  enabled,
}: {
  window: PeriodWindow;
  windowKey: string;
  enabled: boolean;
}) {
  const client = useMastraClient();
  return useQuery({
    queryKey: ['overview', 'agents-eval-scores', windowKey],
    queryFn: () => fetchAgentsEvalScores(client, window),
    enabled,
  });
}
