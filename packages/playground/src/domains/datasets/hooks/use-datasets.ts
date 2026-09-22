import type { ExperimentTargetType, ListDatasetsParams } from '@mastra/client-js';
import { useInView } from '@mastra/playground-ui/hooks/use-in-view';
import { useMastraClient } from '@mastra/react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';

/**
 * Hook to list all datasets with optional pagination
 */
export const useDatasets = (pagination?: { page?: number; perPage?: number }) => {
  const client = useMastraClient();
  return useQuery({
    queryKey: ['datasets', pagination],
    queryFn: () => client.listDatasets(pagination),
    placeholderData: previousData => previousData,
  });
};

const DATASETS_PER_PAGE = 20;

export interface DatasetTargetFilter {
  targetType?: ExperimentTargetType | '';
  targetId?: string;
}

export type DatasetsOrderBy = NonNullable<ListDatasetsParams['orderBy']>;

/**
 * Hook to list datasets with infinite scroll pagination, optionally scoped server-side to a target.
 */
export const useInfiniteDatasets = (filter?: DatasetTargetFilter, orderBy?: DatasetsOrderBy) => {
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
    select: data => data.pages.flatMap(page => page?.datasets ?? []),
  });

  useEffect(() => {
    if (isEndOfListInView && query.hasNextPage && !query.isFetchingNextPage) {
      void query.fetchNextPage();
    }
  }, [isEndOfListInView, query]);

  return { ...query, setEndOfListElement };
};

/**
 * Hook to fetch a single dataset by ID
 */
export const useDataset = (datasetId: string) => {
  const client = useMastraClient();
  return useQuery({
    queryKey: ['dataset', datasetId],
    queryFn: () => client.getDataset(datasetId),
    enabled: Boolean(datasetId),
  });
};
