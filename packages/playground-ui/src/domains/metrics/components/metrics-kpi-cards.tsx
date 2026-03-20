import { MetricsKpiCard } from '@/ds/components/MetricsKpiCard';
import { formatCompact } from './metrics-utils';
import { useAgentRunsKpiMetrics } from '../hooks/use-agent-runs-kpi-metrics';
import { useTotalTokensKpiMetrics } from '../hooks/use-total-tokens-kpi-metrics';
import { useAvgScoreKpiMetrics } from '../hooks/use-avg-score-kpi-metrics';

export function AgentRunsKpiCard() {
  const { data: agentRunsKpi } = useAgentRunsKpiMetrics();
  const hasData = agentRunsKpi?.value != null;

  return (
    <MetricsKpiCard>
      <MetricsKpiCard.Label>Total Agent Runs</MetricsKpiCard.Label>
      <MetricsKpiCard.Value className={hasData ? undefined : 'invisible'}>
        {hasData ? agentRunsKpi.value!.toLocaleString() : '—'}
      </MetricsKpiCard.Value>
      {hasData ? (
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
  return (
    <MetricsKpiCard>
      <MetricsKpiCard.Label>Total Model Cost</MetricsKpiCard.Label>
      <MetricsKpiCard.Value className="invisible">—</MetricsKpiCard.Value>
      <MetricsKpiCard.NoData />
    </MetricsKpiCard>
  );
}

export function TotalTokensKpiCard() {
  const { data: totalTokensKpi } = useTotalTokensKpiMetrics();
  const hasData = totalTokensKpi?.value != null;

  return (
    <MetricsKpiCard>
      <MetricsKpiCard.Label>Total Tokens</MetricsKpiCard.Label>
      <MetricsKpiCard.Value className={hasData ? undefined : 'invisible'}>
        {hasData ? formatCompact(totalTokensKpi.value!) : '—'}
      </MetricsKpiCard.Value>
      {hasData ? (
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
  const { data: avgScoreKpi } = useAvgScoreKpiMetrics();
  const hasData = avgScoreKpi?.value != null;

  return (
    <MetricsKpiCard>
      <MetricsKpiCard.Label>Avg Score</MetricsKpiCard.Label>
      <MetricsKpiCard.Value className={hasData ? undefined : 'invisible'}>
        {hasData ? String(avgScoreKpi.value) : '—'}
      </MetricsKpiCard.Value>
      {hasData ? (
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
