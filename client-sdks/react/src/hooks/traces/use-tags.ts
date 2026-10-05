import type { MastraClient } from '@mastra/client-js';
import type { UseQueryResult } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { useMastraClient } from '../../mastra-client-context';
import type { MastraQueryOptions } from '../shared/query-options';
import { DISCOVERY_STALE_TIME } from './discovery-cache';

type TagsResponse = Awaited<ReturnType<MastraClient['getTags']>>;
type TagsData = TagsResponse['tags'];

export const useTags = <TData = TagsData>({
  queryOptions,
}: {
  queryOptions?: MastraQueryOptions<TagsResponse, TData>;
} = {}): UseQueryResult<TData, Error> => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['observability-tags'],
    queryFn: async (): Promise<TagsResponse> => {
      try {
        return await client.getTags();
      } catch {
        // Storage provider may not support tag discovery (e.g. LibSQL)
        return { tags: [] };
      }
    },
    select: data => (data?.tags ?? []) as TData,
    retry: false,
    staleTime: DISCOVERY_STALE_TIME,
    ...queryOptions,
  });
};
