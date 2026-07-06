import type { ReactNode } from 'react';
import { MetricsKpiCard } from '../../../ds/components/MetricsKpiCard';

export interface KpiCardViewProps {
  label: string;
  value: string | null;
  prevValue?: string;
  changePct?: number | null;
  isLoading: boolean;
  isError: boolean;
}

export function KpiCardView({ label, value, prevValue, changePct, isLoading, isError }: KpiCardViewProps) {
  const hasData = value != null;
  let statusSlot: ReactNode;

  if (isError) {
    statusSlot = <MetricsKpiCard.Error />;
  } else if (isLoading) {
    statusSlot = <MetricsKpiCard.Loading />;
  } else if (hasData) {
    if (changePct != null) {
      statusSlot = <MetricsKpiCard.Change changePct={changePct} prevValue={prevValue} />;
    } else {
      statusSlot = <MetricsKpiCard.NoChange />;
    }
  } else {
    statusSlot = <MetricsKpiCard.NoData />;
  }

  return (
    <MetricsKpiCard>
      <MetricsKpiCard.Label>{label}</MetricsKpiCard.Label>
      <MetricsKpiCard.Value className={hasData ? undefined : 'invisible'}>{hasData ? value : '—'}</MetricsKpiCard.Value>
      {statusSlot}
    </MetricsKpiCard>
  );
}
