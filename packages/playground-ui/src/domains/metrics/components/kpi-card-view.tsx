import type { ReactNode } from 'react';
import { MetricsKpiCard } from '../../../ds/components/MetricsKpiCard';
import { useMetrics } from '../hooks/use-metrics';

export interface KpiCardViewProps {
  label: string;
  value: ReactNode;
  prevValue?: string;
  changePct?: number | null;
  isLoading: boolean;
  isError: boolean;
  /** Treat a decrease as a good change (e.g. cost, latency). */
  lowerIsBetter?: boolean;
}

export function KpiCardView({
  label,
  value,
  prevValue,
  changePct,
  isLoading,
  isError,
  lowerIsBetter,
}: KpiCardViewProps) {
  const { comparisonLabel } = useMetrics();
  const hasData = value != null;
  const hasChange = hasData && !isLoading && !isError && changePct != null && changePct !== 0;
  return (
    <MetricsKpiCard>
      <MetricsKpiCard.Header>
        <MetricsKpiCard.Label>{label}</MetricsKpiCard.Label>
        {hasChange ? (
          <MetricsKpiCard.Change
            changePct={changePct}
            comparison={comparisonLabel}
            prevValue={prevValue}
            lowerIsBetter={lowerIsBetter}
          />
        ) : null}
      </MetricsKpiCard.Header>
      <MetricsKpiCard.ValueRow>
        {hasData ? <MetricsKpiCard.Value>{value}</MetricsKpiCard.Value> : null}
        {isError ? (
          <MetricsKpiCard.Error />
        ) : isLoading ? (
          <MetricsKpiCard.Loading />
        ) : !hasData ? (
          <MetricsKpiCard.NoData />
        ) : hasChange ? null : (
          <MetricsKpiCard.NoChange />
        )}
      </MetricsKpiCard.ValueRow>
    </MetricsKpiCard>
  );
}
