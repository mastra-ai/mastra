import type { ReactNode } from 'react';
import { MetricsCard } from '../../../../ds/components/MetricsCard/metrics-card';

export interface ModelUsageCostCardLayoutProps {
  summary?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}

/** Fixed frame shared by every model usage state, so loading never shifts the layout. */
export function ModelUsageCostCardLayout({ summary, actions, children }: ModelUsageCostCardLayoutProps) {
  return (
    <MetricsCard>
      <MetricsCard.TopBar>
        <MetricsCard.TitleAndDescription title="Model Usage & Cost" description="Token consumption by model." />
        {summary}
        {actions && <MetricsCard.Actions>{actions}</MetricsCard.Actions>}
      </MetricsCard.TopBar>
      <div className="min-h-72 min-w-0">{children}</div>
    </MetricsCard>
  );
}
