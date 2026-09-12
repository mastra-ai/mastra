import { Button } from '@mastra/playground-ui/components/Button';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { NoDataPageLayout, PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { CircleSlashIcon, ExternalLinkIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { MetricsCapabilityError } from './metrics-capability-error';
import { useObservabilityStorageCapabilities } from '@/domains/configuration/hooks/use-observability-storage-capabilities';

/** Keep dashboard queries unmounted until the observability store supports them. */
export function MetricsStorageGate({ children }: { children: ReactNode }) {
  const { supportsMetrics, isLoading, error } = useObservabilityStorageCapabilities();

  if (isLoading) return undefined;
  if (error) {
    return (
      <NoDataPageLayout>
        <MetricsCapabilityError error={error} />
      </NoDataPageLayout>
    );
  }
  if (supportsMetrics) return children;

  return (
    <PageLayout width="wide" height="full">
      <div className="flex h-full items-center justify-center">
        <EmptyState
          iconSlot={<CircleSlashIcon />}
          titleSlot="Metrics are not available with your current storage"
          descriptionSlot="Metrics require ClickHouse, DuckDB, Postgres v-next, Spanner, or in-memory storage for observability. Other relational databases (LibSQL, MSSQL) and document stores (MongoDB) do not support metrics collection. To enable metrics on an existing project, switch the observability storage in the Mastra configuration."
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
    </PageLayout>
  );
}
