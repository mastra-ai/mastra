import { useMastraClient } from '@mastra/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { METADATA_FILTER_PREFIX } from '../metadata-filter-values';
import { DISCOVERY_STALE_TIME } from './discovery-cache';
import type { FilterBarField } from '@/ds/components/FilterBar/types';

export function useMetadataFilterFields(timeRange: { from: string; to: string }) {
  const client = useMastraClient();
  const queryClient = useQueryClient();
  const result = useQuery({
    queryKey: ['trace-query-metadata-fields', timeRange],
    queryFn: ({ signal }) => client.getTraceQueryFields({ timeRange, predicateScope: 'trace' }, { signal }),
    staleTime: DISCOVERY_STALE_TIME,
    retry: false,
  });
  const fields: FilterBarField[] = (result.data?.observedFields ?? []).map(field => {
    const path = typeof field.path === 'string' ? ['metadata', field.path.slice('metadata.'.length)] : field.path;
    return {
      id: `${METADATA_FILTER_PREFIX}${JSON.stringify(path)}`,
      label: `Metadata ${JSON.stringify(path.slice(1))}`,
      type: 'text',
      operators: ['is'],
      strict: true,
      suggestions: async ({ query, signal }) => {
        const values = await queryClient.fetchQuery({
          queryKey: ['trace-query-metadata-values', timeRange, path, query],
          queryFn: () =>
            client.getTraceQueryValues({ timeRange, predicateScope: 'trace', path, search: query }, { signal }),
          staleTime: DISCOVERY_STALE_TIME,
        });
        return values.values.map(({ value }) => ({ value: JSON.stringify(value), label: JSON.stringify(value) }));
      },
    };
  });
  return {
    fields,
    isLoading: result.isLoading,
    isError: result.isError,
    truncated: result.data?.observedFieldsTruncated ?? false,
  };
}
