import { MetricsKpiCard } from '@mastra/playground-ui';
import { useAgentRunsKpiMetrics } from '../hooks/use-agent-runs-kpi-metrics';
import { useAvgScoreKpiMetrics } from '../hooks/use-avg-score-kpi-metrics';
import { useModelCostKpiMetrics } from '../hooks/use-model-cost-kpi-metrics';
import { useTotalTokensKpiMetrics } from '../hooks/use-total-tokens-kpi-metrics';
import { formatCompact, formatCost } from './metrics-utils';

export function AgentRunsKpiCard() {
  const { data: agentRunsKpi, isLoading, isError } = useAgentRunsKpiMetrics();
  const hasData = agentRunsKpi?.value != null;

  return (
    <MetricsKpiCard>
      <MetricsKpiCard.Label>Total Agent Runs</MetricsKpiCard.Label>
      <MetricsKpiCard.Value className={hasData ? undefined : 'invisible'}>
        {hasData ? agentRunsKpi.value!.toLocaleString() : '—'}
      </MetricsKpiCard.Value>
      {isError ? (
        <MetricsKpiCard.Error />
      ) : isLoading ? (
        <MetricsKpiCard.Loading />
      ) : hasData ? (
        agentRunsKpi.changePercent != null ? (
          <MetricsKpiCard.Change
            changePct={agentRunsKpi.changePercent}
            prevValue={agentRunsKpi.previousValue?.toLocaleString()}
          />
        ) : (
          <MetricsKpiCard.NoChange />
        )
      ) : (
        <MetricsKpiCard.NoData />
      )}
    </MetricsKpiCard>
  );
}

export function ModelCostKpiCard() {
  const { data: costKpi, isLoading, isError } = useModelCostKpiMetrics();
  const hasData = costKpi?.cost != null;

  return (
    <MetricsKpiCard>
      <MetricsKpiCard.Label>Total Model Cost</MetricsKpiCard.Label>
      <MetricsKpiCard.Value className={hasData ? undefined : 'invisible'}>
        {hasData ? formatCost(costKpi.cost!, costKpi.costUnit) : '—'}
      </MetricsKpiCard.Value>
      {isError ? (
        <MetricsKpiCard.Error />
      ) : isLoading ? (
        <MetricsKpiCard.Loading />
      ) : hasData ? (
        costKpi.costChangePercent != null ? (
          <MetricsKpiCard.Change
            changePct={costKpi.costChangePercent}
            prevValue={costKpi.previousCost != null ? formatCost(costKpi.previousCost, costKpi.costUnit) : undefined}
          />
        ) : (
          <MetricsKpiCard.NoChange />
        )
      ) : (
        <MetricsKpiCard.NoData />
      )}
    </MetricsKpiCard>
  );
}

export function TotalTokensKpiCard() {
  const { data: totalTokensKpi, isLoading, isError } = useTotalTokensKpiMetrics();
  const hasData = totalTokensKpi?.value != null;

  return (
    <MetricsKpiCard>
      <MetricsKpiCard.Label>Total Tokens</MetricsKpiCard.Label>
      <MetricsKpiCard.Value className={hasData ? undefined : 'invisible'}>
        {hasData ? formatCompact(totalTokensKpi.value!) : '—'}
      </MetricsKpiCard.Value>
      {isError ? (
        <MetricsKpiCard.Error />
      ) : isLoading ? (
        <MetricsKpiCard.Loading />
      ) : hasData ? (
        totalTokensKpi.changePercent != null ? (
          <MetricsKpiCard.Change
            changePct={totalTokensKpi.changePercent}
            prevValue={totalTokensKpi.previousValue != null ? formatCompact(totalTokensKpi.previousValue) : undefined}
          />
        ) : (
          <MetricsKpiCard.NoChange />
        )
      ) : (
        <MetricsKpiCard.NoData />
      )}
    </MetricsKpiCard>
  );
}

export function AvgScoreKpiCard() {
  const { data: avgScoreKpi, isLoading, isError } = useAvgScoreKpiMetrics();
  const hasData = avgScoreKpi?.value != null;

  return (
    <MetricsKpiCard>
      <MetricsKpiCard.Label>Avg Score</MetricsKpiCard.Label>
      <MetricsKpiCard.Value className={hasData ? undefined : 'invisible'}>
        {hasData ? String(avgScoreKpi.value) : '—'}
      </MetricsKpiCard.Value>
      {isError ? (
        <MetricsKpiCard.Error />
      ) : isLoading ? (
        <MetricsKpiCard.Loading />
      ) : hasData ? (
        avgScoreKpi.changePercent != null ? (
          <MetricsKpiCard.Change
            changePct={avgScoreKpi.changePercent}
            prevValue={avgScoreKpi.previousValue != null ? String(avgScoreKpi.previousValue) : undefined}
          />
        ) : (
          <MetricsKpiCard.NoChange />
        )
      ) : (
        <MetricsKpiCard.NoData />
      )}
    </MetricsKpiCard>
  );
}
