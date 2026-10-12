import type { MastraClient } from '@mastra/client-js';
import { EntityType } from '@mastra/core/observability';
import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';
import type { OverviewRange, PeriodWindow } from '@/domains/overview/overview-period';
import { fetchRunActivity } from '@/domains/overview/run-activity';

export interface AgentsSpend {
  costByAgentId: Map<string, number>;
  tokens: number | null;
  previousTokens: number | null;
  tokensChangePercent: number | null;
  cost: number | null;
  previousCost: number | null;
  costChangePercent: number | null;
}

const AGENT_RUN_METRIC = 'mastra_agent_duration_ms';
const TOKEN_METRICS: [string, ...string[]] = ['mastra_model_total_input_tokens', 'mastra_model_total_output_tokens'];

async function fetchAgentsSpend(client: MastraClient, window: PeriodWindow): Promise<AgentsSpend> {
  const agentFilters = { timestamp: window, entityType: EntityType.AGENT };
  const [byAgent, totals] = await Promise.all([
    client.getMetricBreakdown({
      name: TOKEN_METRICS,
      aggregation: 'sum',
      groupBy: ['entityId'],
      filters: agentFilters,
    }),
    client.getMetricAggregate({
      name: TOKEN_METRICS,
      aggregation: 'sum',
      filters: agentFilters,
      comparePeriod: 'previous_period',
    }),
  ]);
  const costByAgentId = new Map<string, number>();
  for (const group of byAgent.groups) {
    const agentId = group.dimensions.entityId;
    if (agentId && group.estimatedCost != null) costByAgentId.set(agentId, group.estimatedCost);
  }
  return {
    costByAgentId,
    tokens: totals.value,
    previousTokens: totals.previousValue ?? null,
    tokensChangePercent: totals.changePercent ?? null,
    cost: totals.estimatedCost ?? null,
    previousCost: totals.previousEstimatedCost ?? null,
    costChangePercent: totals.costChangePercent ?? null,
  };
}

export function useAgentsActivity({
  range,
  window,
  windowKey,
  enabled,
}: {
  range: OverviewRange;
  window: PeriodWindow;
  windowKey: string;
  enabled: boolean;
}) {
  const client = useMastraClient();
  return useQuery({
    queryKey: ['overview', 'agents-activity', range, windowKey],
    queryFn: async () => {
      const [runs, spend] = await Promise.all([
        fetchRunActivity(client, { metricName: AGENT_RUN_METRIC, window, range }),
        fetchAgentsSpend(client, window),
      ]);
      return { ...runs, spend };
    },
    enabled,
  });
}
