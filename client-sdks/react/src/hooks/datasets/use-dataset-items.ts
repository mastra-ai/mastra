import type { MastraClient } from '@mastra/client-js';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import type { InfiniteData, QueryKey, UseInfiniteQueryResult, UseQueryResult } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useMastraClient } from '../../mastra-client-context';
import type { MastraInfiniteQueryOptions, MastraQueryOptions } from '../shared/query-options';
import { useInView } from '../shared/use-in-view';

/**
 * Hook to fetch a single dataset item by ID
 */
type DatasetItemResponse = Awaited<ReturnType<MastraClient['getDatasetItem']>>;

/**
 * Does not guard on empty ids; pass `queryOptions: { enabled }` to skip the fetch.
 */
export const useDatasetItem = <TData = DatasetItemResponse>({
  datasetId,
  itemId,
  queryOptions,
}: {
  datasetId: string;
  itemId: string;
  queryOptions?: MastraQueryOptions<DatasetItemResponse, TData>;
}): UseQueryResult<TData, Error> => {
  const client = useMastraClient();
  return useQuery({
    queryKey: ['dataset-item', datasetId, itemId],
    queryFn: () => client.getDatasetItem(datasetId, itemId),
    retry: false, // Don't retry 404s for deleted items
    ...queryOptions,
  });
};

const PER_PAGE = 10;

type ListDatasetItemsResponse = Awaited<ReturnType<MastraClient['listDatasetItems']>>;

export type UseDatasetItemsResult = Omit<
  UseInfiniteQueryResult<InfiniteData<ListDatasetItemsResponse>, Error>,
  'data'
> & {
  data: ListDatasetItemsResponse['items'];
  total: number | undefined;
  setEndOfListElement: (element: HTMLDivElement | null) => void;
};

/**
 * Hook to list items in a dataset with infinite scroll pagination and optional search
 * @param version - Optional version timestamp to view historical snapshot
 */
export type DatasetItemsOrderBy = NonNullable<NonNullable<Parameters<MastraClient['listDatasetItems']>[1]>['orderBy']>;

/**
 * Does not guard on empty ids; pass `queryOptions: { enabled }` to skip the fetch.
 */
export const useDatasetItems = ({
  datasetId,
  search,
  version,
  orderBy,
  queryOptions,
}: {
  datasetId: string;
  search?: string;
  version?: number | null;
  orderBy?: DatasetItemsOrderBy;
  queryOptions?: MastraInfiniteQueryOptions<
    ListDatasetItemsResponse,
    InfiniteData<ListDatasetItemsResponse, number>,
    QueryKey,
    number
  >;
}): UseDatasetItemsResult => {
  const client = useMastraClient();
  const { inView: isEndOfListInView, setRef: setEndOfListElement } = useInView();

  const query = useInfiniteQuery({
    queryKey: ['dataset-items', datasetId, search, version, orderBy],
    queryFn: async ({ pageParam }) => {
      const res = await client.listDatasetItems(datasetId, {
        page: pageParam,
        perPage: PER_PAGE,
        search: search || undefined,
        version: version || undefined,
        orderBy,
      });
      return res;
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, _, lastPageParam) => {
      if (!lastPage?.items?.length) {
        return undefined;
      }
      const totalFetched = (lastPageParam + 1) * PER_PAGE;
      const total = lastPage?.pagination?.total ?? 0;
      if (totalFetched >= total) {
        return undefined;
      }
      return lastPageParam + 1;
    },
    retry: false,
    ...queryOptions,
  });

  const items = query.data?.pages.flatMap(page => page?.items ?? []) ?? [];
  const total = query.data?.pages[0]?.pagination?.total;

  useEffect(() => {
    if (isEndOfListInView && query.hasNextPage && !query.isFetchingNextPage) {
      void query.fetchNextPage();
    }
  }, [isEndOfListInView, query]);

  return { ...query, data: items, total, setEndOfListElement };
};
