import type { TracesFilters, TracesSort } from '../components/traces-explorer/traces-explorer-actions';
import type {
  TracesExplorerCapabilities,
  TracesExplorerTraces,
} from '../components/traces-explorer/traces-explorer-data';
import {
  buildTracesListLegacyFilters,
  buildTracesListQuery,
  resolveTracesSort,
  resolveTracesSupport,
  sanitizeTracesFiltersFor,
} from '../components/traces-explorer/traces-explorer-support';
import type { TracesExplorerFeatures, TracesRootSource } from '../components/traces-explorer/traces-explorer-support';
import { useTracesDateWindow } from '../components/traces-explorer/use-traces-date-window';
import type { TraceColumnPreferences } from '../trace-list-columns';
import { useTracesListSource } from './use-traces-list-source';
import { hasTokenSearchFilter } from '@/domains/observability/lib/token-search-predicate';

export type UseTracesListQueryArgs = {
  /** The host's filters, as it hands them to `TracesExplorer`. */
  filters: TracesFilters;
  sort: TracesSort;
  /** The visible columns: a TTFC/TTFT sort only runs on a shown column. */
  columns: TraceColumnPreferences;
  capabilities: TracesExplorerCapabilities;
  features?: TracesExplorerFeatures;
  rootSource?: TracesRootSource;
};

/**
 * Studio's traces list for the explorer, through the Mastra client: the trace query for the filters and
 * sort (or `listTracesLight` on servers without it), polled for new traces. Pass the result as
 * `TracesExplorer`'s `traces`.
 */
export function useTracesListQuery({
  filters: rawFilters,
  sort: hostSort,
  columns,
  capabilities,
  features,
  rootSource,
}: UseTracesListQueryArgs): TracesExplorerTraces {
  const support = resolveTracesSupport(capabilities, features);
  const filters = sanitizeTracesFiltersFor(rawFilters, support);
  const { dateFrom, dateTo } = useTracesDateWindow(rawFilters);
  const sort = resolveTracesSort(hostSort, support, columns);
  const hasTokenSearch = support.withTokenSearch && [...filters.tokens, ...filters.groups].some(hasTokenSearchFilter);

  const list = useTracesListSource({
    rolling: !dateTo,
    query: now => buildTracesListQuery({ filters, dateFrom, dateTo, support, rootSource, now }),
    orderBy: [sort],
    // An explicit projection must never fall back to the legacy list endpoint.
    withQueryTrace: rootSource === 'aggregated' || support.withQueryTrace,
    withDeltaPolling: !hasTokenSearch && rootSource !== 'aggregated' && support.withDeltaPolling,
    enabled: !support.isCapabilitiesLoading,
    legacyFilters: buildTracesListLegacyFilters({ filters, dateFrom, dateTo }),
  });

  return {
    rows: list.rows,
    isLoading: list.isLoading,
    isFetching: list.isFetching,
    isFetchingNextPage: list.isFetchingNextPage,
    hasNextPage: list.hasNextPage,
    error: list.error ?? undefined,
    onLoadMore: list.fetchNextPage,
    onRetry: list.refetch,
  };
}
