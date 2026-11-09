import type { MastraClient } from '@mastra/client-js';
import type { UseQueryResult } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { useMastraClient } from '../../mastra-client-context';
import type { MastraQueryOptions } from '../shared/query-options';

export interface Vector {
  name: string;
  id: string;
  description?: string;
}

type VectorsResponse = Awaited<ReturnType<MastraClient['listVectors']>>;

export function useVectors<TData = VectorsResponse>({
  queryOptions,
}: {
  queryOptions?: MastraQueryOptions<VectorsResponse, TData>;
} = {}): UseQueryResult<TData, Error> {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['vectors'],
    queryFn: async () => {
      const data = await client.listVectors();
      return data;
    },
    staleTime: 30000, // Cache for 30 seconds
    ...queryOptions,
  });
}
