import type { ListExperimentsParams } from '@mastra/client-js';
import { useInView } from '@mastra/playground-ui/hooks/use-in-view';
import { useMastraClient } from '@mastra/react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import type { ExperimentTargetFilter } from './use-experiments-for-dataset-filter';

export const EXPERIMENTS_PER_PAGE = 100;

/**
 * Infinite-scroll experiments for the list page: the global list, or the dataset-scoped list when a
 * dataset filter is active (a dataset's runs may not be in the first pages of the global list). The
 * optional target filter is applied server-side for the same reason.
 */
export function useInfiniteExperiments(datasetId: string | undefined, target?: ExperimentTargetFilter) {
  const client = useMastraClient();
  const { inView: isEndOfListInView, setRef: setEndOfListElement } = useInView();
  const targetType = target?.targetType || undefined;
  const targetId = target?.targetId || undefined;

  const query = useInfiniteQuery({
    // Prefixes match the keys invalidated by dataset/experiment mutations.
    queryKey: datasetId
      ? ['dataset-experiments', datasetId, 'infinite', { targetType, targetId }]
      : ['experiments', 'infinite', { targetType, targetId }],
    queryFn: ({ pageParam }) => {
      const params: ListExperimentsParams = { page: pageParam, perPage: EXPERIMENTS_PER_PAGE };
      if (targetType) params.targetType = targetType;
      if (targetId) params.targetId = targetId;
      return datasetId ? client.listDatasetExperiments(datasetId, params) : client.listExperiments(params);
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, _, lastPageParam) => {
      if (!lastPage?.experiments?.length || !lastPage.pagination?.hasMore) {
        return undefined;
      }
      return lastPageParam + 1;
    },
    select: data => data.pages.flatMap(page => page?.experiments ?? []),
  });

  useEffect(() => {
    if (isEndOfListInView && query.hasNextPage && !query.isFetchingNextPage) {
      void query.fetchNextPage();
    }
  }, [isEndOfListInView, query]);

  return { ...query, setEndOfListElement };
}
