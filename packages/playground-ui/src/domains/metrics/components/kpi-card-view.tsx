import type { ReactNode } from 'react';
import { MetricsKpiCard } from '../../../ds/components/MetricsKpiCard';

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
  const hasData = value != null;
  return (
    <MetricsKpiCard>
      <MetricsKpiCard.Label>{label}</MetricsKpiCard.Label>
      <MetricsKpiCard.ValueRow>
        {hasData ? <MetricsKpiCard.Value>{value}</MetricsKpiCard.Value> : null}
        {isError ? (
          <MetricsKpiCard.Error />
        ) : isLoading ? (
          <MetricsKpiCard.Loading />
        ) : hasData ? (
          changePct != null && changePct !== 0 ? (
            <MetricsKpiCard.Change changePct={changePct} prevValue={prevValue} lowerIsBetter={lowerIsBetter} />
          ) : (
            <MetricsKpiCard.NoChange />
          )
        ) : (
          <MetricsKpiCard.NoData />
        )}
      </MetricsKpiCard.ValueRow>
    </MetricsKpiCard>
  );
}
