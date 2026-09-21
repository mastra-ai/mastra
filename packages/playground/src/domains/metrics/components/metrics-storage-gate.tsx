import { Button } from '@mastra/playground-ui/components/Button';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { NoDataPageLayout } from '@mastra/playground-ui/components/PageLayout';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { createMetricsPropertyFilterFields } from '@mastra/playground-ui/domains/metrics/metrics-filters';
import { CircleSlashIcon, ExternalLinkIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { metricsCrumbs } from '../metrics-crumbs';
import { MetricsCapabilityError } from './metrics-capability-error';
import { MetricsPageLayout } from './metrics-page-layout';
import { pageHeaderProps } from '@/components/ui/page-header-props';
import { useObservabilityStorageCapabilities } from '@/domains/configuration/hooks/use-observability-storage-capabilities';

const filterFieldsWithoutDiscovery = createMetricsPropertyFilterFields({
  availableTags: [],
  availableEntityNames: [],
  availableServiceNames: [],
  availableEnvironments: [],
});

/** Keep dashboard queries unmounted until the observability store supports them. */
export function MetricsStorageGate({ children }: { children: ReactNode }) {
  const { supportsMetrics, isLoading, error } = useObservabilityStorageCapabilities();

  if (isLoading) {
    return (
      <MetricsPageLayout filterFields={filterFieldsWithoutDiscovery} isLoading>
        <div className="flex h-full items-center justify-center gap-2">
          <Spinner aria-label="Loading storage capabilities" />
          <span className="text-ui-sm text-muted-foreground">Loading storage capabilities</span>
        </div>
      </MetricsPageLayout>
    );
  }
  if (error) {
    return (
      <NoDataPageLayout {...pageHeaderProps(metricsCrumbs)}>
        <MetricsCapabilityError error={error} />
      </NoDataPageLayout>
    );
  }
  if (supportsMetrics) return children;

  return (
    <MetricsPageLayout filterFields={filterFieldsWithoutDiscovery}>
      <div className="flex h-full items-center justify-center">
        <EmptyState
          iconSlot={<CircleSlashIcon />}
          titleSlot="Metrics are not available with your current storage"
          descriptionSlot="Metrics require ClickHouse, DuckDB, Postgres v-next, Spanner, or in-memory storage for observability. Other relational databases (LibSQL, MSSQL) and document stores (MongoDB) do not support metrics collection. To enable metrics on an existing project, switch the observability storage in the Mastra configuration."
          actionSlot={
            <Button
              variant="ghost"
              render={
                <a
                  href="https://mastra.ai/docs/observability/metrics/overview"
                  target="_blank"
                  rel="noopener noreferrer"
                />
              }

              icon={<ExternalLinkIcon />}
            >
              Metrics Documentation
            </Button>
          }
        />
      </div>
    </MetricsPageLayout>
  );
}
