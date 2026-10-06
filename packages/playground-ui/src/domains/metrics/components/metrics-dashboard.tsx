import type { ReactNode } from 'react';
import { AgentRunsCard } from './agent-runs-card';
import { FailureRateCard } from './failure-rate-card';
import { LatencyCard } from './latency-card';
import { MetricsKpis } from './metrics-kpis';
import { TokenUsageCard } from './token-usage-card';
import { TraceVolumeCard } from './trace-volume-card';
import { UsageCard } from './usage-card';

export type MetricsDashboardProps = {
  /** App-specific cards after the shared ones, two across on wide pages. */
  children?: ReactNode;
};

/**
 * The Metrics page body, shared by Studio and Platform: KPIs, token usage, then runs, failure
 * rate and latency (three across on wide pages, two plus a full-width third on medium ones),
 * then trace volume beside usage, then any app-specific cards. Rows wrap by the page's width
 * (container queries), not the window's. Render inside `MetricsProvider`.
 */
export function MetricsDashboard({ children }: MetricsDashboardProps) {
  return (
    <div className="grid content-start gap-4 pb-6">
      <MetricsKpis />
      <TokenUsageCard />
      <div className="@container">
        <div className="grid gap-4 @2xl:grid-cols-2 @5xl:grid-cols-3">
          <AgentRunsCard />
          <FailureRateCard />
          <div className="grid @2xl:col-span-2 @5xl:col-span-1">
            <LatencyCard />
          </div>
        </div>
      </div>
      <div className="@container">
        <div className="grid gap-4 @2xl:grid-cols-2">
          <TraceVolumeCard />
          <UsageCard />
          {children}
        </div>
      </div>
    </div>
  );
}
