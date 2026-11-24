import type { EntityType } from '@mastra/core/observability';
import { TracesExplorer } from '@mastra/playground-ui/domains/traces/components/traces-explorer';
import { useTraceColumnPreferences } from '@mastra/playground-ui/domains/traces/hooks/use-trace-column-preferences';
import { useTracesDiscoveryQuery } from '@mastra/playground-ui/domains/traces/hooks/use-traces-discovery-query';
import { useTracesListQuery } from '@mastra/playground-ui/domains/traces/hooks/use-traces-list-query';
import { TRACE_PROPERTY_FILTER_PARAM_BY_FIELD } from '@mastra/playground-ui/domains/traces/trace-filters';
import { useObservabilityCapabilities } from '@mastra/react/hooks/capabilities';
import { useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { STUDIO_TRACES_FEATURES } from './features';
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

  const { data: capabilitiesData, isLoading: isCapabilitiesLoading } = useObservabilityCapabilities();
  // Memoized for its identity: the memoized parts below compare it.
  const capabilities = useMemo(
    () => ({ data: capabilitiesData, isLoading: isCapabilitiesLoading }),
    [capabilitiesData, isCapabilitiesLoading],
  );
  const { supportsMetrics, isLoading: isMetricsLoading } = useObservabilityStorageCapabilities();
  const metricsSupport = useMemo(
    () => ({ supported: supportsMetrics, isLoading: isMetricsLoading }),
    [supportsMetrics, isMetricsLoading],
  );
  const scope = useMemo(
    () => (scopedEntityId ? { entityId: scopedEntityId, entityType: scopedEntityType } : undefined),
    [scopedEntityId, scopedEntityType],
  );

  // The explorer never fetches: the page loads its records through the Mastra client and hands them down.
  const columns = useTraceColumnPreferences();
  const traces = useTracesListQuery({
    filters: route.filters,
    sort: route.sort,
    columns: columns.preferences,
    capabilities,
    features: STUDIO_TRACES_FEATURES,
  });
  const discovery = useTracesDiscoveryQuery({ filters: route.filters, capabilities, features: STUDIO_TRACES_FEATURES });
  const { rows, isLoading: isListLoading } = traces;
  const listedTraces = useMemo(() => ({ rows, isLoading: isListLoading }), [rows, isListLoading]);

  return (
    <TracesExplorer
      metricsSupport={metricsSupport}
      selection={route.selection}
      filters={route.filters}
      onChange={route.setState}
      sort={route.sort}
      onSortChange={route.setSort}
      columns={columns.preferences}
      onColumnsChange={columns.setPreferences}
      capabilities={capabilities}
      traces={traces}
      discovery={discovery}
      scope={scope}
      features={STUDIO_TRACES_FEATURES}
    >
      <TracesPageContent
        isScoped={isScoped}
        selection={route.selection}
        filters={route.filters}
        capabilities={capabilities}
        columns={columns.preferences}
        metricsSupport={metricsSupport}
        traces={listedTraces}
      />
    </TracesExplorer>
  );
}
