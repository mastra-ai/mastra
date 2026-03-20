import { ModelUsageCostCard } from './model-usage-cost-card';
import { TracesVolumeCard } from './traces-volume-card';
import { LatencyCard } from './latency-card';
import { ScoresCard } from './scores-card';
import { TokenUsageByAgentCard } from './token-usage-by-agent-card';
import { AgentRunsKpiCard, ModelCostKpiCard, TotalTokensKpiCard, AvgScoreKpiCard } from './metrics-kpi-cards';
import { MetricsFlexGrid } from '@/ds/components/MetricsFlexGrid';

export function MetricsDashboard() {
  return (
    <div className="grid gap-8 content-start pb-10">
      <MetricsFlexGrid>
        <AgentRunsKpiCard />

        {/* 
          hidden for now
          <ModelCostKpiCard /> 
        */}
        <TotalTokensKpiCard />
        <AvgScoreKpiCard />
      </MetricsFlexGrid>

      <MetricsFlexGrid>
        <ModelUsageCostCard />
        <TokenUsageByAgentCard />
        <ScoresCard />
        <TracesVolumeCard />
        <LatencyCard />
      </MetricsFlexGrid>
    </div>
  );
}
