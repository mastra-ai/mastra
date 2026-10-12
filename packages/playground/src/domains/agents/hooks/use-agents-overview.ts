import type { GetAgentResponse } from '@mastra/client-js';
import { EntityType } from '@mastra/core/observability';
import {
  formatCount,
  formatDuration,
  formatPercent,
  formatUsd,
  percentChange,
} from '@mastra/playground-ui/domains/metrics/lib/chart-format';
import { useLinkComponent } from '@mastra/playground-ui/lib/framework';
import type { ListSort } from '@mastra/playground-ui/sort/sort-by';
import { agentRegressions, agentSortAccessors, isAgentActive } from '../components/agents-overview/agent-roster-row';
import type { AgentRosterRow, AgentSortKey } from '../components/agents-overview/agent-roster-row';
import type { AgentsRosterActivity } from '../components/agents-overview/agents-roster';
import { useAgentsActivity } from './use-agents-activity';
import { useAgentsEvalScores } from './use-agents-eval-scores';
import type { PeriodTotal } from '@/domains/overview/components/period-totals';
import { matchesSearch, orderRoster } from '@/domains/overview/order-roster';
import type { OverviewRange } from '@/domains/overview/overview-period';
import { emptyRunActivity, errorRateOf, sumRunTotals } from '@/domains/overview/run-activity';
import type { RunTotals } from '@/domains/overview/run-activity';
import { useOverviewWindow } from '@/domains/overview/use-overview-window';
import { useRootRunLatency } from '@/domains/overview/use-root-run-latency';
import type { Latency } from '@/domains/overview/use-root-run-latency';

function rateChange(totals: RunTotals) {
  const rate = errorRateOf(totals.runs, totals.errors);
  const previousRate = errorRateOf(totals.previousRuns, totals.previousErrors);
  return rate === null || previousRate === null ? undefined : percentChange(rate, previousRate);
}

function agentsTotals(
  runs: RunTotals,
  latency: Latency | undefined,
  spend: {
    tokens: number | null;
    tokensChangePercent: number | null;
    cost: number | null;
    costChangePercent: number | null;
  },
): PeriodTotal[] {
  const errorRate = errorRateOf(runs.runs, runs.errors);
  const previousErrorRate = errorRateOf(runs.previousRuns, runs.previousErrors);
  return [
    {
      label: 'Runs',
      value: formatCount(runs.runs),
      changePercent: percentChange(runs.runs, runs.previousRuns),
      previousValue: formatCount(runs.previousRuns),
    },
    {
      label: 'Error rate',
      value: errorRate === null ? '–' : formatPercent(errorRate),
      changePercent: rateChange(runs),
      previousValue: previousErrorRate === null ? undefined : formatPercent(previousErrorRate),
      lowerIsBetter: true,
      alert: runs.errors > 0,
    },
    ...(latency
      ? [
          {
            label: 'p95 latency',
            value: latency.p95 === null ? '–' : formatDuration(latency.p95),
            changePercent:
              latency.p95 === null || latency.previousP95 === null
                ? undefined
                : percentChange(latency.p95, latency.previousP95),
            previousValue: latency.previousP95 === null ? undefined : formatDuration(latency.previousP95),
            lowerIsBetter: true,
          },
        ]
      : []),
    {
      label: 'Tokens',
      value: spend.tokens === null ? '–' : formatCount(spend.tokens),
      changePercent: spend.tokensChangePercent,
    },
    {
      label: 'Cost',
      value: spend.cost === null ? '–' : formatUsd(spend.cost),
      changePercent: spend.costChangePercent,
      lowerIsBetter: true,
    },
  ];
}

export function useAgentsOverview({
  agents,
  range,
  search,
  sort,
  showsActivity,
}: {
  agents: Record<string, GetAgentResponse>;
  range: OverviewRange;
  search: string;
  sort: ListSort<AgentSortKey>;
  showsActivity: boolean;
}) {
  const { paths } = useLinkComponent();
  const { window, windowKey } = useOverviewWindow(range);
  const activity = useAgentsActivity({ range, window, windowKey, enabled: showsActivity });
  const latency = useRootRunLatency({ entityType: EntityType.AGENT, window, windowKey, enabled: showsActivity });
  const scores = useAgentsEvalScores({ window, windowKey, enabled: showsActivity });

  const bucketCount = activity.data?.bucketCount ?? 0;
  const rows: AgentRosterRow[] = Object.values(agents).map(agent => ({
    id: agent.id,
    name: agent.name,
    agent,
    activity: showsActivity ? (activity.data?.byEntityId.get(agent.id) ?? emptyRunActivity(bucketCount)) : undefined,
    cost: activity.data?.spend.costByAgentId.get(agent.id) ?? null,
    latency: latency.data?.byName.get(agent.name),
    scores: scores.data?.get(agent.id),
  }));
  const matching = rows.filter(row =>
    matchesSearch(search, [row.name, row.id, row.agent.description, row.agent.modelId]),
  );
  const ordered = orderRoster(matching, { sort, accessors: agentSortAccessors, isActive: isAgentActive });

  const rosterActivity: AgentsRosterActivity | undefined =
    showsActivity && activity.data
      ? {
          range,
          nowMs: window.end.getTime(),
          totalCost: activity.data.spend.cost ?? 0,
          latencyStatus: latency.status,
          showsScores: rows.some(row => row.scores),
        }
      : undefined;
  const totals = activity.data
    ? agentsTotals(sumRunTotals(activity.data.byEntityId.values()), latency.data?.total, activity.data.spend)
    : undefined;

  return {
    isLoading: showsActivity && activity.isLoading,
    error: activity.error,
    rows: ordered,
    rosterActivity,
    totals,
    regressions: agentRegressions(rows, paths.agentLink),
  };
}
