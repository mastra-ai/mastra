import type { MastraClient } from '@mastra/client-js';
import type { UseQueryResult } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { useMastraClient } from '../../mastra-client-context';
import type { MastraQueryOptions } from '../shared/query-options';
import { DISCOVERY_STALE_TIME } from './discovery-cache';

type ServiceNamesResponse = Awaited<ReturnType<MastraClient['getServiceNames']>>;
type ServiceNamesData = ServiceNamesResponse['serviceNames'];

export const useServiceNames = <TData = ServiceNamesData>({
  queryOptions,
}: {
  queryOptions?: MastraQueryOptions<ServiceNamesResponse, TData>;
} = {}): UseQueryResult<TData, Error> => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['observability-service-names'],
    queryFn: async (): Promise<ServiceNamesResponse> => {
      try {
        return await client.getServiceNames();
      } catch {
        return { serviceNames: [] };
      }
    },
    select: data => (data?.serviceNames ?? []) as TData,
    retry: false,
    staleTime: DISCOVERY_STALE_TIME,
    ...queryOptions,
  });
};
