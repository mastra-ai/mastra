import {
  Notice,
  Button,
  ButtonWithTooltip,
  DateRangeSelector,
  EmptyState,
  ErrorState,
  MetricsFlexGrid,
  MetricsProvider,
  NoDataPageLayout,
  PageHeader,
  PageLayout,
  PermissionDenied,
  SessionExpired,
  is401UnauthorizedError,
  is403ForbiddenError,
  isValidPreset,
  useAgentRunsKpiMetrics,
} from '@mastra/playground-ui';
import type { DatePreset } from '@mastra/playground-ui';
import { BarChart3Icon, BookIcon, CircleSlashIcon, ExternalLinkIcon } from 'lucide-react';
import { useCallback } from 'react';
import { useSearchParams } from 'react-router';
import { useMastraPackages } from '@/domains/configuration/hooks/use-mastra-packages';
import { LatencyCard } from '@/domains/metrics/components/latency-card';
import { AgentRunsKpiCard, ModelCostKpiCard, TotalTokensKpiCard } from '@/domains/metrics/components/metrics-kpi-cards';
import { ModelUsageCostCard } from '@/domains/metrics/components/model-usage-cost-card';
import { ScoresCard } from '@/domains/metrics/components/scores-card';
import { TokenUsageByAgentCard } from '@/domains/metrics/components/token-usage-by-agent-card';
import { TracesVolumeCard } from '@/domains/metrics/components/traces-volume-card';

const ANALYTICS_OBSERVABILITY_TYPES = new Set([
  'ObservabilityStorageClickhouseVNext',
  'ObservabilityStorageDuckDB',
  'ObservabilityInMemory',
]);

const PERIOD_PARAM = 'period';

export default function MetricsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlPreset = searchParams.get(PERIOD_PARAM);
  const initialPreset: DatePreset = isValidPreset(urlPreset) ? urlPreset : '24h';

  const handlePresetChange = useCallback(
    (preset: DatePreset) => {
      setSearchParams(
        prev => {
          const next = new URLSearchParams(prev);
          if (preset === '24h') {
            next.delete(PERIOD_PARAM);
          } else {
            next.set(PERIOD_PARAM, preset);
          }
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  return (
    <MetricsProvider initialPreset={initialPreset} onPresetChange={handlePresetChange}>
      <MetricsContent />
    </MetricsProvider>
  );
}

function MetricsContent() {
  const { error } = useAgentRunsKpiMetrics();
  const { data, isLoading } = useMastraPackages();
  const observabilityType = data?.observabilityStorageType;
  const supportsMetrics = observabilityType ? ANALYTICS_OBSERVABILITY_TYPES.has(observabilityType) : false;
  const isInMemory = observabilityType === 'ObservabilityInMemory';

  if (error && is401UnauthorizedError(error)) {
    return (
      <NoDataPageLayout title="Metrics" icon={<BarChart3Icon />}>
        <SessionExpired />
      </NoDataPageLayout>
    );
  }

  if (error && is403ForbiddenError(error)) {
    return (
      <NoDataPageLayout title="Metrics" icon={<BarChart3Icon />}>
        <PermissionDenied resource="metrics" />
      </NoDataPageLayout>
    );
  }

  if (error) {
    return (
      <NoDataPageLayout title="Metrics" icon={<BarChart3Icon />}>
        <ErrorState title="Failed to load metrics" message={error.message} />
      </NoDataPageLayout>
    );
  }

  return (
    <PageLayout width="wide" height="full">
      <PageLayout.TopArea className="sticky top-0 z-100 bg-surface1 ">
        <PageLayout.Row>
          <PageLayout.Column>
            <PageHeader>
              <PageHeader.Title>
                <BarChart3Icon /> Metrics
              </PageHeader.Title>
            </PageHeader>
          </PageLayout.Column>
          <PageLayout.Column className="flex justify-end gap-2">
            <DateRangeSelector />
            <ButtonWithTooltip
              as="a"
              href="https://mastra.ai/en/docs/observability/overview"
              target="_blank"
              rel="noopener noreferrer"
              tooltipContent="Go to Metrics documentation"
            >
              <BookIcon />
            </ButtonWithTooltip>
          </PageLayout.Column>
        </PageLayout.Row>
      </PageLayout.TopArea>

      {isLoading ? null : !supportsMetrics ? (
        <div className="flex h-full items-center justify-center">
          <EmptyState
            iconSlot={<CircleSlashIcon />}
            titleSlot="Metrics are not available with your current storage"
            descriptionSlot="Metrics require ClickHouse, DuckDB, or in-memory storage for observability. Relational databases (PostgreSQL, LibSQL) do not support metrics collection. To enable metrics on an existing project, switch the observability storage in the Mastra configuration."
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
      ) : (
        <div className="grid gap-8 content-start pb-10">
          {isInMemory && (
            <Notice variant="info" title="Metrics are not persisted">
              <Notice.Message>
                This project uses in-memory storage for observability. Metrics will be lost on every server restart. For
                persistent metrics, switch the observability storage to ClickHouse or DuckDB.
              </Notice.Message>
            </Notice>
          )}

          <MetricsFlexGrid>
            <AgentRunsKpiCard />
            <ModelCostKpiCard />
            <TotalTokensKpiCard />
          </MetricsFlexGrid>

          <MetricsFlexGrid>
            <ModelUsageCostCard />
            <TokenUsageByAgentCard />
            <ScoresCard />
            <TracesVolumeCard />
            <LatencyCard />
          </MetricsFlexGrid>
        </div>
      )}
    </PageLayout>
  );
}
