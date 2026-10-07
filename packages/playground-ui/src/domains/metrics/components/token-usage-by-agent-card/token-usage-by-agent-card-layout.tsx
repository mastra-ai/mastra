import type { ReactNode } from 'react';
import { MetricsCard } from '../../../../ds/components/MetricsCard/metrics-card';

export interface TokenUsageByAgentCardLayoutProps {
  summary?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}

/** Fixed frame shared by every token usage state, so loading never shifts the layout. */
export function TokenUsageByAgentCardLayout({ summary, actions, children }: TokenUsageByAgentCardLayoutProps) {
  return (
    <MetricsCard>
      <MetricsCard.TopBar>
        <MetricsCard.TitleAndDescription
          title="Token Usage by Agent"
          description="Token consumption grouped by agent."
        />
        {summary}
        {actions && <MetricsCard.Actions>{actions}</MetricsCard.Actions>}
      </MetricsCard.TopBar>
      <div className="min-h-72 min-w-0">{children}</div>
    </MetricsCard>
  );
}
