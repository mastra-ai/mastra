import type { ReactNode } from 'react';
import { MetricsCard } from '../../../../ds/components/MetricsCard/metrics-card';

export interface MemoryCardLayoutProps {
  summary?: ReactNode;
  children: ReactNode;
}

/** Fixed frame shared by every memory card state, so loading never shifts the layout. */
export function MemoryCardLayout({ summary, children }: MemoryCardLayoutProps) {
  return (
    <MetricsCard>
      <MetricsCard.TopBar>
        <MetricsCard.TitleAndDescription title="Memory" description="Thread and resource consumption." />
        {summary}
      </MetricsCard.TopBar>
      <div className="h-65 min-w-0">{children}</div>
    </MetricsCard>
  );
}
