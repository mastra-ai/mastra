import type { MastraClient } from '@mastra/client-js';
import { useInfiniteQuery } from '@tanstack/react-query';
import type { InfiniteData, QueryKey } from '@tanstack/react-query';
import { useMastraClient } from '../../mastra-client-context';
import type { MastraInfiniteQueryOptions } from '../shared/query-options';

export interface DatasetVersion {
  id?: string;
  datasetId?: string;
  version: number;
  createdAt?: Date | string;
  isCurrent: boolean;
}

type DatasetVersionsPage = Awaited<ReturnType<MastraClient['listDatasetVersions']>>;

const PER_PAGE = 10;

/**
 * Hook to fetch dataset versions from the API with infinite pagination.
 * `data` defaults to the flattened `DatasetVersion[]`; a user `select` replaces that.
 *
 * Does not guard on empty ids; pass `queryOptions: { enabled }` to skip the fetch.
 */
export const useDatasetVersions = <TData = DatasetVersion[]>({
  datasetId,
  queryOptions,
}: {
  datasetId: string;
  queryOptions?: MastraInfiniteQueryOptions<DatasetVersionsPage, TData, QueryKey, number>;
}) => {
  const client = useMastraClient();

  return useInfiniteQuery({
    queryKey: ['dataset-versions', datasetId],
    queryFn: async ({ pageParam }) => {
      return client.listDatasetVersions(datasetId, { page: pageParam, perPage: PER_PAGE });
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, _, lastPageParam) => {
      if (lastPage?.pagination?.hasMore) {
        return lastPageParam + 1;
      }
      return undefined;
    },
    select: (data: InfiniteData<DatasetVersionsPage, number>) => {
      return data.pages
        .flatMap(page => page?.versions ?? [])
        .map(
          (v, index): DatasetVersion => ({
            id: v.id,
            datasetId: v.datasetId,
            version: v.version,
            createdAt: v.createdAt,
            isCurrent: index === 0,
          }),
        ) as TData;
    },
    ...queryOptions,
  });
};
