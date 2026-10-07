import type { ReactNode } from 'react';
import { MetricsKpiCard } from '../../../../ds/components/MetricsKpiCard';

export interface KpiCardValueProps {
  value: ReactNode;
  hasChange: boolean;
}

/** Resolved value row: the value, plus a "no comparison" hint when there is no delta to show. */
export function KpiCardValue({ value, hasChange }: KpiCardValueProps) {
  return (
    <>
      <MetricsKpiCard.Value>{value}</MetricsKpiCard.Value>
      {!hasChange && <MetricsKpiCard.NoChange />}
    </>
  );
}
