import { LatencyCard } from './latency-card';
import { AgentRunsKpiCard, TotalTokensKpiCard, AvgScoreKpiCard } from './metrics-kpi-cards';
import { ModelUsageCostCard } from './model-usage-cost-card';
import { ScoresCard } from './scores-card';
import { TokenUsageByAgentCard } from './token-usage-by-agent-card';
import { TracesVolumeCard } from './traces-volume-card';
import { Alert, AlertTitle, AlertDescription } from '@/ds/components/Alert';
import { MetricsFlexGrid } from '@/ds/components/MetricsFlexGrid';

export function MetricsDashboard() {
  return (
    <div className="grid gap-8 content-start pb-10">
      <Alert variant="warning">
        <AlertTitle>Analytics storage required</AlertTitle>
        <AlertDescription as="p">
          Metrics require an analytics-optimized storage backend such as ClickHouse or DuckDB. Relational databases
          (PostgreSQL, LibSQL) are not supported for metrics collection.
        </AlertDescription>
      </Alert>
      {/* 
      <Alert variant="warning">
        <AlertTitle>Metrics are not available with your current storage</AlertTitle>
        <AlertDescription as="p">
          Metrics require ClickHouse or DuckDB for observability. Relational databases (PostgreSQL, LibSQL) do not
          support metrics collection. To enable metrics on an existing project, switch your observability storage to
          ClickHouse or DuckDB in your Mastra configuration.
        </AlertDescription>
      </Alert> */}

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
