import { useModelCostKpiMetrics } from '@mastra/react/hooks/metrics';
import { CompactNumber } from '../../../../ds/components/CompactNumber/compact-number';
import { MetricsKpiCard } from '../../../../ds/components/MetricsKpiCard';
import { useMetricsFilters } from '../../hooks/use-metrics-filters';
import { KpiCardChange } from './kpi-card-change';
import { KpiCardLayout } from './kpi-card-layout';
import { KpiCardSkeleton } from './kpi-card-skeleton';
import { KpiCardValue } from './kpi-card-value';
import { hasKpiChange } from './kpi-card.utils';
import { formatFullNumber } from '@/lib/cost';

const LABEL = 'Model cost';

export function ModelCostKpiCard() {
  const { data, isLoading, isError } = useModelCostKpiMetrics(useMetricsFilters());

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

  if (data?.cost == null) {
    return (
      <KpiCardLayout label={LABEL}>
        <MetricsKpiCard.NoData />
      </KpiCardLayout>
    );
  }
  const currency = data.costUnit ?? undefined;

  const changePct = data.costChangePercent;
  const change = hasKpiChange(changePct) ? (
    <KpiCardChange
      changePct={changePct}
      prevValue={data.previousCost != null ? formatFullNumber(data.previousCost, { currency }) : undefined}
      lowerIsBetter
    />
  ) : undefined;

  return (
    <KpiCardLayout label={LABEL} change={change}>
      <KpiCardValue value={<CompactNumber value={data.cost} currency={currency} />} hasChange={change !== undefined} />
    </KpiCardLayout>
  );
}
