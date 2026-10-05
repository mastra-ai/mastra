import type { UseQueryResult } from '@tanstack/react-query';
import type { MastraClient } from '@mastra/client-js';
import { useQuery } from '@tanstack/react-query';
import { useMastraClient } from '../../mastra-client-context';
import type { MastraQueryOptions } from '../shared/query-options';

type SystemPackagesResponse = Awaited<ReturnType<MastraClient['getSystemPackages']>>;

export const useMastraPackages = <TData = SystemPackagesResponse>({
  queryOptions,
}: { queryOptions?: MastraQueryOptions<SystemPackagesResponse, TData> } = {}): UseQueryResult<TData, Error> => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['mastra-packages'],
    queryFn: () => {
      return client.getSystemPackages();
    },
    ...queryOptions,
  });
};
