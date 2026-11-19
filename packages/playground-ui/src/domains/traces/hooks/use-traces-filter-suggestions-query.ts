import { useMastraClient } from '@mastra/react';
import { createTraceQueryValuesResolver, useEntityNames, useEnvironments } from '@mastra/react/hooks/traces';
import { useMemo } from 'react';
import { getSelectedEntityOption } from '../components/traces-explorer/traces-explorer-actions';
import type { TracesFilters } from '../components/traces-explorer/traces-explorer-actions';
import type {
  TracesExplorerCapabilities,
  TracesExplorerFilterSuggestions,
} from '../components/traces-explorer/traces-explorer-data';
import { resolveTracesSupport, sanitizeTracesFiltersFor } from '../components/traces-explorer/traces-explorer-support';
import type { TracesExplorerFeatures } from '../components/traces-explorer/traces-explorer-support';
import type { TraceQueryRelatedScope } from '../trace-query-filters';
import { useTracesDiscoveryWindow } from './use-traces-discovery-window';

/** Studio always offers a pick list: an empty one while the names load. */
const NO_NAMES: string[] = [];

export type UseTracesFilterSuggestionsQueryArgs = {
  filters: TracesFilters;
  capabilities: TracesExplorerCapabilities;
  features?: TracesExplorerFeatures;
};

/**
 * Studio's filter bar suggestions, through the Mastra client: the root entity names (of the selected
 * entity type), the environments, and a resolver of the values observed for a field in the filters'
 * window. Pass the result as `TracesExplorer.FilterBar`'s `suggestions`.
 */
export function useTracesFilterSuggestionsQuery({
  filters: rawFilters,
  capabilities,
  features,
}: UseTracesFilterSuggestionsQueryArgs): TracesExplorerFilterSuggestions {
  const support = resolveTracesSupport(capabilities, features);
  const filters = sanitizeTracesFiltersFor(rawFilters, support);
  const selectedEntityType = getSelectedEntityOption(filters.tokens)?.entityType;
  const { data: rootEntityNames = NO_NAMES } = useEntityNames({ entityType: selectedEntityType, rootOnly: true });
  const { data: environments = NO_NAMES } = useEnvironments();
  const client = useMastraClient();
  const timeRange = useTracesDiscoveryWindow(rawFilters);
  const { withQueryTrace } = support;

  // Memoized for correctness: the filter bar's fields (and their Combobox items) are rebuilt when it changes.
  const resolveValues = useMemo(
    () =>
      withQueryTrace
        ? (scope: TraceQueryRelatedScope | 'trace', path: string) =>
            createTraceQueryValuesResolver(client, timeRange, scope, path)
        : undefined,
    [withQueryTrace, client, timeRange],
  );

  return { rootEntityNames, environments, resolveValues };
}
