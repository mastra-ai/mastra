import { CircleSlashIcon, ExternalLinkIcon } from 'lucide-react';
import { LatencyCard } from './latency-card';
import { AgentRunsKpiCard, ModelCostKpiCard, TotalTokensKpiCard, AvgScoreKpiCard } from './metrics-kpi-cards';
import { ModelUsageCostCard } from './model-usage-cost-card';
import { ScoresCard } from './scores-card';
import { TokenUsageByAgentCard } from './token-usage-by-agent-card';
import { TracesVolumeCard } from './traces-volume-card';
import { useMastraPackages } from '@/domains/configuration/hooks/use-mastra-packages';
import { Alert, AlertTitle, AlertDescription } from '@/ds/components/Alert';
import { Button } from '@/ds/components/Button';
import { EmptyState } from '@/ds/components/EmptyState';
import { MetricsFlexGrid } from '@/ds/components/MetricsFlexGrid';

const ANALYTICS_OBSERVABILITY_TYPES = new Set([
  // 'ObservabilityStorageClickhouse',
  'ObservabilityStorageDuckDB',
  'ObservabilityInMemory',
]);

export function MetricsDashboard() {
  const { data, isLoading } = useMastraPackages();
  const observabilityType = data?.observabilityStorageType;
  const supportsMetrics = observabilityType ? ANALYTICS_OBSERVABILITY_TYPES.has(observabilityType) : false;
  const isInMemory = observabilityType === 'ObservabilityInMemory';

  if (isLoading) {
    return null;
  }

  if (!supportsMetrics) {
    return (
      <div className="flex h-full items-center justify-center">
        <EmptyState
          iconSlot={<CircleSlashIcon />}
          titleSlot="Metrics are not available with your current storage"
          descriptionSlot="Metrics require DuckDB or in-memory storage for observability. ClickHouse support is coming soon. Relational databases (PostgreSQL, LibSQL) do not support metrics collection. To enable metrics on an existing project, switch the observability storage in the Mastra configuration."
          actionSlot={
            <Button
              variant="ghost"
              as="a"
              href="https://mastra.ai/docs/observability/metrics/overview"
              target="_blank"
              rel="noopener noreferrer"
            >
              Metrics Documentation <ExternalLinkIcon />
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="grid gap-8 content-start pb-10">
      {isInMemory && (
        <Alert variant="info">
          <AlertTitle>Metrics are not persisted</AlertTitle>
          <AlertDescription as="p">
            This project uses in-memory storage for observability. Metrics will be lost on every server restart. For
            persistent metrics, switch the observability storage to ClickHouse or DuckDB.
          </AlertDescription>
        </Alert>
      )}

      <MetricsFlexGrid>
        <AgentRunsKpiCard />
        <ModelCostKpiCard />
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
