import type { ReactNode } from 'react';
import { MetricsKpiCard } from '../../../../ds/components/MetricsKpiCard';

export interface KpiCardLayoutProps {
  label: string;
  change?: ReactNode;
  children: ReactNode;
}

/** Fixed KPI frame: the label renders immediately, the value row is the only slot that changes. */
export function KpiCardLayout({ label, change, children }: KpiCardLayoutProps) {
  return (
    <MetricsKpiCard>
      <MetricsKpiCard.Header>
        <MetricsKpiCard.Label>{label}</MetricsKpiCard.Label>
        {change}
      </MetricsKpiCard.Header>
      <MetricsKpiCard.ValueRow>{children}</MetricsKpiCard.ValueRow>
    </MetricsKpiCard>
  );
}
