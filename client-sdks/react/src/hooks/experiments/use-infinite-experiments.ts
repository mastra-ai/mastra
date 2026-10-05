import type { DatasetExperiment, ListExperimentsParams, MastraClient } from '@mastra/client-js';
import { useInfiniteQuery } from '@tanstack/react-query';
import type { InfiniteData, QueryKey, UseInfiniteQueryResult } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useMastraClient } from '../../mastra-client-context';
import type { MastraInfiniteQueryOptions } from '../shared/query-options';
import { useInView } from '../shared/use-in-view';
import type { ExperimentTargetFilter } from './use-experiments-for-dataset-filter';

export const EXPERIMENTS_PER_PAGE = 100;

/**
 * Infinite-scroll experiments for the list page: the global list, or the dataset-scoped list when a
 * dataset filter is active (a dataset's runs may not be in the first pages of the global list). The
 * optional target filter is applied server-side for the same reason.
 */
export type ExperimentsOrderBy = NonNullable<ListExperimentsParams['orderBy']>;

type ListExperimentsResponse = Awaited<ReturnType<MastraClient['listExperiments']>>;

export function useInfiniteExperiments<TData = DatasetExperiment[]>({
  datasetId,
  target,
  orderBy,
  queryOptions,
}: {
  datasetId: string | undefined;
  target?: ExperimentTargetFilter;
  orderBy?: ExperimentsOrderBy;
  queryOptions?: MastraInfiniteQueryOptions<ListExperimentsResponse, TData, QueryKey, number>;
}): UseInfiniteQueryResult<TData, Error> & {
  setEndOfListElement: (element: HTMLDivElement | null) => void;
} {
  const client = useMastraClient();
  const { inView: isEndOfListInView, setRef: setEndOfListElement } = useInView();
  const targetType = target?.targetType || undefined;
  const targetId = target?.targetId || undefined;

  const query = useInfiniteQuery({
    // Prefixes match the keys invalidated by dataset/experiment mutations.
    queryKey: datasetId
      ? ['dataset-experiments', datasetId, 'infinite', { targetType, targetId, orderBy }]
      : ['experiments', 'infinite', { targetType, targetId, orderBy }],
    queryFn: ({ pageParam }) => {
      const params: ListExperimentsParams = { page: pageParam, perPage: EXPERIMENTS_PER_PAGE };
      if (targetType) params.targetType = targetType;
      if (targetId) params.targetId = targetId;
      if (orderBy) params.orderBy = orderBy;
      return datasetId ? client.listDatasetExperiments(datasetId, params) : client.listExperiments(params);
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, _, lastPageParam) => {
      if (!lastPage?.experiments?.length || !lastPage.pagination?.hasMore) {
        return undefined;
      }
      return lastPageParam + 1;
    },
    select: (data: InfiniteData<ListExperimentsResponse, number>) =>
      data.pages.flatMap(page => page?.experiments ?? []) as TData,
    ...queryOptions,
  });

  useEffect(() => {
    if (isEndOfListInView && query.hasNextPage && !query.isFetchingNextPage) {
      void query.fetchNextPage();
    }
  }, [isEndOfListInView, query]);

  return { ...query, setEndOfListElement };
}
