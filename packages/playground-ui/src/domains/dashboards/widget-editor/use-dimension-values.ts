import type { DashboardQuery } from '@mastra/client-js';
import { useMastraClient } from '@mastra/react';
import { useQueryClient } from '@tanstack/react-query';
import { useMetricsFilters } from '../../metrics/hooks/use-metrics-filters';
import { useDashboardRequests } from '../hooks/use-dashboard-requests';
import { groupsOf } from '../lib/answers';
import type { DashboardAnswer } from '../lib/requests';
import { buildRequest, requestKey, sendRequest } from '../lib/requests';
import { STATIC_ENTRIES } from './catalogue';
import type { CatalogueEntry } from './catalogue';
import type { FilterBarSuggestionsResolver } from '@/ds/components/FilterBar';

const DISCOVERY_LIMIT = 50;
/** Dimension values seen on token usage, when no metric is picked yet. */
const FALLBACK_NAMES = STATIC_ENTRIES.flatMap(e => (e.id === 'total-tokens' && e.source === 'metrics' ? e.names : []));

/** The query whose groups list a dimension's values; for metrics a count, busiest first. */
function discoveryQuery(entry: CatalogueEntry | undefined, dimension: string): DashboardQuery {
  const groupBy = [dimension];
  if (entry?.source === 'scores')
    return { source: 'scores', request: 'breakdown', scorerId: entry.scorerId, aggregation: 'count', groupBy };
  const name = !entry ? FALLBACK_NAMES : entry.source === 'metrics' ? entry.names : [entry.name];
  return { source: 'metrics', request: 'breakdown', name, aggregation: 'count', groupBy, limit: DISCOVERY_LIMIT };
}

function valuesOf(answer: DashboardAnswer | undefined, dimension: string | undefined) {
  const values = (groupsOf(answer) ?? []).flatMap(g => {
    const value = dimension ? g.dimensions[dimension] : undefined;
    return value ? [value] : [];
  });
  return [...new Set(values)];
}

/** The values a dimension takes for a metric in the page's range and filters. */
export function useDimensionValues(entry: CatalogueEntry | undefined, dimension: string | undefined) {
  const { filters, timestamp } = useMetricsFilters();
  const query = dimension ? discoveryQuery(entry, dimension) : undefined;
  const [result] = useDashboardRequests([query && buildRequest(query, { window: timestamp, filters }, {})]);
  return { values: valuesOf(result?.data, dimension), isLoading: result?.isLoading ?? false };
}

/**
 * The same values as `useDimensionValues`, fetched only when a filter bar opens a dimension's
 * value step. Shares the dashboard's cache, so a split and a filter on one dimension ask once.
 */
export function useDimensionSuggestions(entry: CatalogueEntry | undefined) {
  const client = useMastraClient();
  const queryClient = useQueryClient();
  const { filters, timestamp } = useMetricsFilters();
  return (dimension: string): FilterBarSuggestionsResolver =>
    async ({ query }) => {
      const request = buildRequest(discoveryQuery(entry, dimension), { window: timestamp, filters }, {});
      if (!request) return [];
      const answer = await queryClient.fetchQuery({
        queryKey: requestKey(request),
        queryFn: () => sendRequest(client, request),
      });
      const needle = query.trim().toLowerCase();
      return valuesOf(answer, dimension)
        .filter(value => value.toLowerCase().includes(needle))
        .map(value => ({ value }));
    };
}
