import type { UseQueryResult } from '@tanstack/react-query';
import type { MastraClient } from '@mastra/client-js';
import { useQuery } from '@tanstack/react-query';
import { useMastraClient } from '../../mastra-client-context';
import type { MastraQueryOptions } from '../shared/query-options';

const OBSERVABILITY_CAPABILITIES_STALE_TIME = 24 * 60 * 60 * 1000;

type ObservabilityCapabilitiesResponse = Awaited<ReturnType<MastraClient['getObservabilityCapabilities']>>;

export const useObservabilityCapabilities = <TData = ObservabilityCapabilitiesResponse>({
  queryOptions,
}: { queryOptions?: MastraQueryOptions<ObservabilityCapabilitiesResponse, TData> } = {}): UseQueryResult<
  TData,
  Error
> => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['observability-capabilities'],
    queryFn: () => client.getObservabilityCapabilities(),
    retry: false,
    staleTime: OBSERVABILITY_CAPABILITIES_STALE_TIME,
    ...queryOptions,
  });
};
