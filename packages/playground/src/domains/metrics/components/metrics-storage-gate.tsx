import { BrandLoader } from '@mastra/playground-ui/components/BrandLoader';
import { Button } from '@mastra/playground-ui/components/Button';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { createMetricsFilterBarFields } from '@mastra/playground-ui/domains/metrics/metrics-filters';
import { IconSquareArrowTopRight } from '@mastra/playground-ui/icons/central/IconSquareArrowTopRight';
import type { ReactNode } from 'react';
import { metricsCrumbs } from '../metrics-crumbs';
import { MetricsCapabilityError } from './metrics-capability-error';
import { MetricsPageLayout } from './metrics-page-layout';
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs';
import { useObservabilityStorageCapabilities } from '@/domains/configuration/hooks/use-observability-storage-capabilities';

const filterFieldsWithoutDiscovery = createMetricsFilterBarFields({
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
      <MetricsPageLayout filterFields={filterFieldsWithoutDiscovery}>
        <BrandLoader fill aria-label="Loading storage capabilities" />
      </MetricsPageLayout>
    );
  }
  if (error) {
    return (
      <PageLayout variant="page" breadcrumbs={<PageBreadcrumbs crumbs={metricsCrumbs} />}>
        <h1 className="sr-only">Metrics</h1>
        <div className="flex h-full items-center justify-center">
          <MetricsCapabilityError error={error} />
        </div>
      </PageLayout>
    );
  }
  if (supportsMetrics) return children;

  return (
    <MetricsPageLayout filterFields={filterFieldsWithoutDiscovery}>
      <EmptyState
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

            icon={<IconSquareArrowTopRight />}
          >
            Metrics documentation
          </Button>
        }
        variant="fill"
      />
    </MetricsPageLayout>
  );
}
