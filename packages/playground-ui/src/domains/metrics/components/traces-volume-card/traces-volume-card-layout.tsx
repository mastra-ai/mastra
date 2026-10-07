import type { ReactNode } from 'react';
import { MetricsCard } from '../../../../ds/components/MetricsCard/metrics-card';

export interface TracesVolumeCardLayoutProps {
  summary?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}

/** Fixed frame shared by every trace-volume state, so loading never shifts the layout. */
export function TracesVolumeCardLayout({ summary, actions, children }: TracesVolumeCardLayoutProps) {
  return (
    <MetricsCard>
      <MetricsCard.TopBar>
        <MetricsCard.TitleAndDescription title="Trace Volume" description="Runs and call counts." />
        {summary}
        {actions && <MetricsCard.Actions>{actions}</MetricsCard.Actions>}
      </MetricsCard.TopBar>
      <div className="min-h-72 min-w-0">{children}</div>
    </MetricsCard>
  );
}
