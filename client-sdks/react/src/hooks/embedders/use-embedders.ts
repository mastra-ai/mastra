import type { UseQueryResult } from '@tanstack/react-query';
import type { MastraClient } from '@mastra/client-js';
import { useQuery } from '@tanstack/react-query';
import { useMastraClient } from '../../mastra-client-context';
import type { MastraQueryOptions } from '../shared/query-options';

export interface Embedder {
  id: string;
  provider: string;
  name: string;
  description: string;
  dimensions: number;
  maxInputTokens: number;
}

type ListEmbeddersResponse = Awaited<ReturnType<MastraClient['listEmbedders']>>;

export function useEmbedders<TData = ListEmbeddersResponse>({
  queryOptions,
}: { queryOptions?: MastraQueryOptions<ListEmbeddersResponse, TData> } = {}): UseQueryResult<TData, Error> {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['embedders'],
    queryFn: async () => {
      const data = await client.listEmbedders();
      return data;
    },
    staleTime: 30000, // Cache for 30 seconds
    ...queryOptions,
  });
}
