import type { GetTraceQueryValuesResponse, MastraClient } from '@mastra/client-js';
import { useMastraClient } from '@mastra/react';
import type { QueryClient } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { DISCOVERY_STALE_TIME } from './discovery-cache';
import type { TraceQueryDiscoveryTimeRange } from './use-trace-query-fields';
import type { FilterBarOption, FilterBarSuggestionsResolver } from '@/ds/components/FilterBar/types';

const VALUES_LIMIT = 100;

export const traceQueryValuesQueryKey = (timeRange: TraceQueryDiscoveryTimeRange, path: string, search: string) =>
  ['trace-query-values', timeRange.from, timeRange.to, path, search] as const;

const fetchTraceQueryValues = (
  client: Pick<MastraClient, 'getTraceQueryValues'>,
  timeRange: TraceQueryDiscoveryTimeRange,
  path: string,
  search: string,
  signal?: AbortSignal,
): Promise<GetTraceQueryValuesResponse> =>
  client.getTraceQueryValues(
    { timeRange, predicateScope: 'trace', path, search: search || undefined, limit: VALUES_LIMIT },
    { signal },
  );

const toOptions = (data: GetTraceQueryValuesResponse): FilterBarOption[] => data.values.map(({ value }) => ({ value }));

/**
 * Builds a lazy FilterBar `suggestions` resolver for one discovered `metadata.*` field.
 * Values are fetched only when the user opens the value step, and cached through React Query.
 */
export const createTraceQueryValuesResolver = ({
  client,
  queryClient,
  timeRange,
  path,
}: {
  client: Pick<MastraClient, 'getTraceQueryValues'>;
  queryClient: QueryClient;
  timeRange: TraceQueryDiscoveryTimeRange;
  path: string;
}): FilterBarSuggestionsResolver => {
  return async ({ query, signal }) => {
    const search = query.trim();
    const data = await queryClient.fetchQuery({
      queryKey: traceQueryValuesQueryKey(timeRange, path, search),
      queryFn: () => fetchTraceQueryValues(client, timeRange, path, search, signal),
      staleTime: DISCOVERY_STALE_TIME,
    });
    return toOptions(data);
  };
};

export const useTraceQueryValues = ({
  timeRange,
  path,
  search = '',
  enabled = true,
}: {
  timeRange: TraceQueryDiscoveryTimeRange;
  path: string;
  search?: string;
  enabled?: boolean;
}) => {
  const client = useMastraClient();
  const trimmed = search.trim();

  return useQuery({
    queryKey: traceQueryValuesQueryKey(timeRange, path, trimmed),
    queryFn: ({ signal }) => fetchTraceQueryValues(client, timeRange, path, trimmed, signal),
    select: toOptions,
    enabled,
    retry: false,
    staleTime: DISCOVERY_STALE_TIME,
  });
};
