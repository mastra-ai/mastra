import type { ReactNode } from 'react';
import { MetricsCard } from '../../../../ds/components/MetricsCard/metrics-card';

export interface LatencyCardLayoutProps {
  description: string;
  actions?: ReactNode;
  children: ReactNode;
}

/** Fixed frame shared by every latency card state, so loading never shifts the layout. */
export function LatencyCardLayout({ description, actions, children }: LatencyCardLayoutProps) {
  return (
    <MetricsCard>
      <MetricsCard.TopBar>
        <MetricsCard.TitleAndDescription title="Latency" description={description} />
        {actions ? <MetricsCard.Actions>{actions}</MetricsCard.Actions> : undefined}
      </MetricsCard.TopBar>
      <div className="min-h-72 min-w-0">{children}</div>
    </MetricsCard>
  );
}
