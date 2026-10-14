import type { ExperimentTargetType, ListDatasetsParams, MastraClient } from '@mastra/client-js';
import { queryOptions as tanstackQueryOptions, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import type {
  InfiniteData,
  QueryKey,
  UseInfiniteQueryResult,
  UseQueryOptions,
  UseQueryResult,
} from '@tanstack/react-query';
import { useEffect } from 'react';
import { useMastraClient } from '../../mastra-client-context';
import type { MastraInfiniteQueryOptions, MastraQueryOptions } from '../shared/query-options';
import { useInView } from '../shared/use-in-view';

type ListDatasetsResponse = Awaited<ReturnType<MastraClient['listDatasets']>>;
type DatasetResponse = Awaited<ReturnType<MastraClient['getDataset']>>;

/**
 * Hook to list all datasets with optional pagination
 */
export const useDatasets = <TData = ListDatasetsResponse>({
  pagination,
  queryOptions,
}: {
  pagination?: { page?: number; perPage?: number };
  queryOptions?: MastraQueryOptions<ListDatasetsResponse, TData>;
} = {}): UseQueryResult<TData, Error> => {
  const client = useMastraClient();
  return useQuery({
    queryKey: ['datasets', pagination],
    queryFn: () => client.listDatasets(pagination),
    placeholderData: previousData => previousData,
    ...queryOptions,
  });
};

const DATASETS_PER_PAGE = 20;

export interface DatasetTargetFilter {
  targetType?: ExperimentTargetType | '';
  targetId?: string;
}

export type DatasetsOrderBy = NonNullable<ListDatasetsParams['orderBy']>;

type DatasetRecord = ListDatasetsResponse['datasets'][number];

export type UseInfiniteDatasetsResult<TData = DatasetRecord[]> = UseInfiniteQueryResult<TData, Error> & {
  setEndOfListElement: (element: HTMLDivElement | null) => void;
};

/**
 * Hook to list datasets with infinite scroll pagination, optionally scoped server-side to a target.
 * `data` defaults to the flattened dataset list; a user `select` replaces that flattening.
 */
export const useInfiniteDatasets = <TData = DatasetRecord[]>({
  filter,
  orderBy,
  queryOptions,
}: {
  filter?: DatasetTargetFilter;
  orderBy?: DatasetsOrderBy;
  queryOptions?: MastraInfiniteQueryOptions<ListDatasetsResponse, TData, QueryKey, number>;
} = {}): UseInfiniteDatasetsResult<TData> => {
  const client = useMastraClient();
  const { inView: isEndOfListInView, setRef: setEndOfListElement } = useInView();
  const targetType = filter?.targetType || undefined;
  const targetIds = filter?.targetId ? [filter.targetId] : undefined;

  const query = useInfiniteQuery({
    queryKey: ['datasets', 'infinite', { targetType, targetIds, orderBy }],
    queryFn: ({ pageParam }) =>
      client.listDatasets({ page: pageParam, perPage: DATASETS_PER_PAGE, targetType, targetIds, orderBy }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, _, lastPageParam) => {
      if (!lastPage?.datasets?.length || !lastPage.pagination?.hasMore) {
        return undefined;
      }
      return lastPageParam + 1;
    },
    select: (data: InfiniteData<ListDatasetsResponse, number>) =>
      data.pages.flatMap(page => page?.datasets ?? []) as TData,
    ...queryOptions,
  });

  useEffect(() => {
    if (isEndOfListInView && query.hasNextPage && !query.isFetchingNextPage) {
      void query.fetchNextPage();
    }
  }, [isEndOfListInView, query]);

  return { ...query, setEndOfListElement };
};

/**
 * Key and fetcher of the `dataset` query, shared by `useDataset` and prefetches (e.g. on hover)
 * so both hit the same cache entry.
 */
export const datasetQueryOptions = (
  client: MastraClient,
  datasetId: string,
): UseQueryOptions<DatasetResponse, Error, DatasetResponse, QueryKey> =>
  tanstackQueryOptions({
    queryKey: ['dataset', datasetId] as QueryKey,
    queryFn: () => client.getDataset(datasetId),
  });

/**
 * Hook to fetch a single dataset by ID
 *
 * Does not guard on empty ids; pass `queryOptions: { enabled }` to skip the fetch.
 */
export const useDataset = <TData = DatasetResponse>({
  datasetId,
  queryOptions,
}: {
  datasetId: string;
  queryOptions?: MastraQueryOptions<DatasetResponse, TData>;
}): UseQueryResult<TData, Error> => {
  const client = useMastraClient();
  // Only the key and fetcher: the shared options are typed for the raw response, this hook takes a `select`.
  const { queryKey, queryFn } = datasetQueryOptions(client, datasetId);
  return useQuery({ queryKey, queryFn, ...queryOptions });
};
