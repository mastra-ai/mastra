import type { ReactNode } from 'react';
import { MetricsCard } from '../../../../ds/components/MetricsCard/metrics-card';

export interface TokenUsageTimelineCardLayoutProps {
  description: string;
  actions?: ReactNode;
  children: ReactNode;
}

/** Fixed frame shared by every timeline state, so loading never shifts the layout. */
export function TokenUsageTimelineCardLayout({ description, actions, children }: TokenUsageTimelineCardLayoutProps) {
  return (
    <MetricsCard>
      <MetricsCard.TopBar>
        <MetricsCard.TitleAndDescription title="Token Usage over Time" description={description} />
        {actions && <MetricsCard.Actions>{actions}</MetricsCard.Actions>}
      </MetricsCard.TopBar>
      <div className="min-h-72 min-w-0">{children}</div>
    </MetricsCard>
  );
}
