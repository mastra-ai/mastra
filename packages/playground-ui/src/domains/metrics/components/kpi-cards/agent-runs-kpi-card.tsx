import { useAgentRunsKpiMetrics } from '@mastra/react/hooks/metrics';
import { CompactNumber } from '../../../../ds/components/CompactNumber/compact-number';
import { MetricsKpiCard } from '../../../../ds/components/MetricsKpiCard';
import { useMetricsFilters } from '../../hooks/use-metrics-filters';
import { KpiCardChange } from './kpi-card-change';
import { KpiCardLayout } from './kpi-card-layout';
import { KpiCardSkeleton } from './kpi-card-skeleton';
import { KpiCardValue } from './kpi-card-value';
import { hasKpiChange } from './kpi-card.utils';
import { formatFullNumber } from '@/lib/cost';

const LABEL = 'Agent Runs';

export function AgentRunsKpiCard() {
  const { data, isLoading, isError } = useAgentRunsKpiMetrics(useMetricsFilters());

  if (isLoading) {
    return (
      <KpiCardLayout label={LABEL}>
        <KpiCardSkeleton label={LABEL} />
      </KpiCardLayout>
    );
  }

  if (isError) {
    return (
      <KpiCardLayout label={LABEL}>
        <MetricsKpiCard.Error />
      </KpiCardLayout>
    );
  }

  if (data?.value == null) {
    return (
      <KpiCardLayout label={LABEL}>
        <MetricsKpiCard.NoData />
      </KpiCardLayout>
    );
  }

  const changePct = data.changePercent;
  const change = hasKpiChange(changePct) ? (
    <KpiCardChange
      changePct={changePct}
      prevValue={data.previousValue != null ? formatFullNumber(data.previousValue) : undefined}
    />
  ) : undefined;

  return (
    <KpiCardLayout label={LABEL} change={change}>
      <KpiCardValue value={<CompactNumber value={data.value} />} hasChange={change !== undefined} />
    </KpiCardLayout>
  );
}
