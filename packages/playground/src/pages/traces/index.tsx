import type { EntityType } from '@mastra/core/observability';
import { TracesExplorer } from '@mastra/playground-ui/domains/traces/components/traces-explorer';
import { TRACE_PROPERTY_FILTER_PARAM_BY_FIELD } from '@mastra/playground-ui/domains/traces/trace-filters';
import { useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { useTraceFilterPersistence } from './hooks/use-trace-filter-persistence';
import { useTracesRouteState } from './hooks/use-traces-route-state';
import { useTracesScopeParams } from './hooks/use-traces-scope-params';
import { TracesPageContent } from './traces-page-content';
import { useObservabilityStorageCapabilities } from '@/domains/configuration/hooks/use-observability-storage-capabilities';

type TracesPageProps = {
  scopedEntityId?: string;
  scopedEntityType?: EntityType;
};

// The agent Chat tab opens its Traces tab filtered to the open conversation. That filter is
// navigation context, so it must not be restored on a later visit.
const SCOPED_UNSAVED_FILTER_PARAMS = [TRACE_PROPERTY_FILTER_PARAM_BY_FIELD.threadId];

export default function TracesPage({ scopedEntityId, scopedEntityType }: TracesPageProps = {}) {
  const isScoped = !!scopedEntityId;
  const [searchParams, setSearchParams] = useSearchParams();

  useTracesScopeParams(searchParams, setSearchParams, scopedEntityId, scopedEntityType);
  const setPersistedSearchParams = useTraceFilterPersistence(searchParams, setSearchParams, {
    storageKey: isScoped ? `mastra:traces:saved-filters:${scopedEntityType}:${scopedEntityId}` : undefined,
    excludeParams: isScoped ? SCOPED_UNSAVED_FILTER_PARAMS : undefined,
  });
  const route = useTracesRouteState(searchParams, setSearchParams, setPersistedSearchParams);

  const { supportsMetrics, isLoading: isMetricsLoading } = useObservabilityStorageCapabilities();
  const metricsSupport = useMemo(
    () => ({ supported: supportsMetrics, isLoading: isMetricsLoading }),
    [supportsMetrics, isMetricsLoading],
  );
  const scope = useMemo(
    () => (scopedEntityId ? { entityId: scopedEntityId, entityType: scopedEntityType } : undefined),
    [scopedEntityId, scopedEntityType],
  );

  return (
    <TracesExplorer
      metricsSupport={metricsSupport}
      selection={route.selection}
      filters={route.filters}
      onChange={route.setState}
      sortDirection={route.sortDirection}
      onSortDirectionChange={route.setSortDirection}
      scope={scope}
    >
      <TracesPageContent isScoped={isScoped} />
    </TracesExplorer>
  );
}
