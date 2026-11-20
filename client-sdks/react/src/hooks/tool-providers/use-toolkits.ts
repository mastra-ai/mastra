import type { MastraClient } from '@mastra/client-js';
import type { UseQueryResult } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { useMastraClient } from '../../mastra-client-context';
import type { MastraQueryOptions } from '../shared/query-options';

type ToolkitsResponse = Awaited<ReturnType<ReturnType<MastraClient['getToolProvider']>['listToolkits']>>;

/**
 * Does not guard on empty ids; pass `queryOptions: { enabled }` to skip the fetch.
 */
export const useToolkits = <TData = ToolkitsResponse>({
  providerId,
  queryOptions,
}: {
  providerId: string | null;
  queryOptions?: MastraQueryOptions<ToolkitsResponse, TData>;
}): UseQueryResult<TData, Error> => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['tool-provider-toolkits', providerId],
    queryFn: () => client.getToolProvider(providerId!).listToolkits(),
    ...queryOptions,
  });
};
