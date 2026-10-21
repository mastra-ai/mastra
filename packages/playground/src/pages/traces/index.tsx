import type { EntityType } from '@mastra/core/observability';
import { useMastraSavedViewsBackend } from '@mastra/playground-ui/domains/saved-views/hooks/use-mastra-saved-views-backend';
import { TracesExplorer } from '@mastra/playground-ui/domains/traces/components/traces-explorer';
import { useTraceColumnsState } from '@mastra/playground-ui/domains/traces/hooks/use-trace-columns-state';
import type { TraceSavedViewSelection } from '@mastra/playground-ui/domains/traces/hooks/use-trace-saved-views';
import {
  loadTraceFiltersFromStorage,
  TRACE_PROPERTY_FILTER_PARAM_BY_FIELD,
} from '@mastra/playground-ui/domains/traces/trace-filters';
import { ALL_TRACES_LIST_ID } from '@mastra/playground-ui/domains/traces/trace-list-columns';
import { TRACE_SAVED_VIEWS_PAGE } from '@mastra/playground-ui/domains/traces/trace-saved-views';
import { useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useTraceFilterPersistence } from './hooks/use-trace-filter-persistence';
import { decodeFilters, DEFAULT_TRACES_SORT, useTracesRouteState } from './hooks/use-traces-route-state';
import { useTracesScopeParams } from './hooks/use-traces-scope-params';
import { TracesPageContent } from './traces-page-content';
import type { TracesSavedViewsHost } from './traces-saved-views-toolbar';
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

  // Saved views are only on the top-level page. They own the columns there so a view can carry them.
  const [columns, setColumns] = useTraceColumnsState(ALL_TRACES_LIST_ID);
  const backend = useMastraSavedViewsBackend(TRACE_SAVED_VIEWS_PAGE);
  // The route's writers change with every URL change; the saved-views props must not, so the
  // memoized page content isn't re-rendered by a trace click.
  const latestRoute = useRef(route);
  latestRoute.current = route;
  const [savedViewHandlers] = useState(() => ({
    onApply: (view: TraceSavedViewSelection | undefined) => {
      if (view) {
        setColumns(view.columns);
        latestRoute.current.applyView(view);
        return;
      }
      // "All traces" brings back the filters the user last chose without a view.
      const lastFilters = decodeFilters(loadTraceFiltersFromStorage() ?? new URLSearchParams());
      latestRoute.current.applyView({
        viewId: undefined,
        filters: lastFilters,
        sortDirection: DEFAULT_TRACES_SORT.direction,
      });
    },
    onActiveViewChange: (viewId: string | undefined) => latestRoute.current.setActiveViewId(viewId),
  }));
  const savedViews = useMemo<TracesSavedViewsHost | undefined>(
    () =>
      isScoped
        ? undefined
        : {
            backend,
            activeViewId: route.activeViewId,
            filters: route.filters,
            sortDirection: route.sortDirection,
            columns,
            ...savedViewHandlers,
          },
    [isScoped, backend, route.activeViewId, route.filters, route.sortDirection, columns, savedViewHandlers],
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

  return (
    <TracesExplorer
      metricsSupport={metricsSupport}
      selection={route.selection}
      filters={route.filters}
      onChange={route.setState}
      sortDirection={route.sortDirection}
      onSortDirectionChange={route.setSortDirection}
      scope={scope}
      {...(!isScoped && { columns, onColumnsChange: setColumns })}
    >
      <TracesPageContent isScoped={isScoped} savedViews={savedViews} />
    </TracesExplorer>
  );
}
