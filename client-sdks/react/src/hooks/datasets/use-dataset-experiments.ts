import type { ClientScoreRowData, DatasetExperimentResult, MastraClient } from '@mastra/client-js';
import type { ExperimentStatus } from '@mastra/core/storage';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import type { InfiniteData, QueryKey, UseInfiniteQueryResult, UseQueryResult } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useMastraClient } from '../../mastra-client-context';
import type { MastraInfiniteQueryOptions, MastraQueryOptions } from '../shared/query-options';
import { useInView } from '../shared/use-in-view';

/**
 * Hook to fetch a single dataset experiment with polling while running
 * Polls every 2 seconds while status is 'running' or 'pending'
 */
type DatasetExperimentResponse = Awaited<ReturnType<MastraClient['getDatasetExperiment']>>;
type ExperimentResultsPage = Awaited<ReturnType<MastraClient['listDatasetExperimentResults']>>;
type ExperimentScoresByEntity = Record<string, ClientScoreRowData[]>;

/**
 * Does not guard on empty ids; pass `queryOptions: { enabled }` to skip the fetch.
 */
export const useDatasetExperiment = <TData = DatasetExperimentResponse>({
  datasetId,
  experimentId,
  queryOptions,
}: {
  datasetId: string;
  experimentId: string;
  queryOptions?: MastraQueryOptions<DatasetExperimentResponse, TData>;
}): UseQueryResult<TData, Error> => {
  const client = useMastraClient();
  return useQuery({
    queryKey: ['dataset-experiment', datasetId, experimentId],
    queryFn: () => client.getDatasetExperiment(datasetId, experimentId),
    gcTime: 0,
    staleTime: 0,
    refetchInterval: query => {
      // Poll while running, stop when complete
      const status = query.state.data?.status;
      return status === 'running' || status === 'pending' ? 2000 : false;
    },
    ...queryOptions,
  });
};

const RESULTS_PER_PAGE = 100;

export type ExperimentResultsOrderBy = NonNullable<
  NonNullable<Parameters<MastraClient['listDatasetExperimentResults']>[2]>['orderBy']
>;

interface UseDatasetExperimentResultsParams<TData = DatasetExperimentResult[]> {
  datasetId: string;
  experimentId: string;
  experimentStatus?: ExperimentStatus;
  orderBy?: ExperimentResultsOrderBy;
  queryOptions?: MastraInfiniteQueryOptions<ExperimentResultsPage, TData, QueryKey, number>;
}

/**
 * Hook to list results for a dataset experiment with infinite scroll pagination.
 * Polls every 2 seconds while experiment status is 'pending' or 'running'.
 *
 * Does not guard on empty ids; pass `queryOptions: { enabled }` to skip the fetch.
 */
export const useDatasetExperimentResults = <TData = DatasetExperimentResult[]>({
  datasetId,
  experimentId,
  experimentStatus,
  orderBy,
  queryOptions,
}: UseDatasetExperimentResultsParams<TData>): UseInfiniteQueryResult<TData, Error> & {
  setEndOfListElement: (element: HTMLDivElement | null) => void;
} => {
  const client = useMastraClient();
  const { inView: isEndOfListInView, setRef: setEndOfListElement } = useInView();

  const query = useInfiniteQuery({
    queryKey: ['dataset-experiment-results', datasetId, experimentId, experimentStatus, orderBy],
    queryFn: async ({ pageParam }) => {
      return client.listDatasetExperimentResults(datasetId, experimentId, {
        page: pageParam,
        perPage: RESULTS_PER_PAGE,
        orderBy,
      });
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, _, lastPageParam) => {
      if (!lastPage?.results?.length) {
        return undefined;
      }
      const totalFetched = (lastPageParam + 1) * RESULTS_PER_PAGE;
      const total = lastPage?.pagination?.total ?? 0;
      if (totalFetched >= total) {
        return undefined;
      }
      return lastPageParam + 1;
    },
    refetchInterval: experimentStatus === 'running' || experimentStatus === 'pending' ? 2000 : false,
    select: (data: InfiniteData<ExperimentResultsPage, number>) => {
      return data.pages.flatMap(page => page?.results ?? []) as TData;
    },
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
 * Hook to fetch all scores for an experiment, transformed to Record<entityId, ClientScoreRowData[]>
 * Paginates through all pages to ensure no scores are silently dropped.
 *
 * Does not guard on empty ids; pass `queryOptions: { enabled }` to skip the fetch.
 */
export const useScoresByExperimentId = <TData = ExperimentScoresByEntity>({
  experimentId,
  experimentStatus,
  queryOptions,
}: {
  experimentId: string;
  experimentStatus?: ExperimentStatus;
  queryOptions?: MastraQueryOptions<ExperimentScoresByEntity, TData>;
}): UseQueryResult<TData, Error> => {
  const client = useMastraClient();
  return useQuery({
    queryKey: ['dataset-experiment-scores', experimentId, experimentStatus],
    queryFn: async (): Promise<ExperimentScoresByEntity> => {
      const allScores: ClientScoreRowData[] = [];
      let page = 0;
      const perPage = 100;

      while (true) {
        const response = await client.listScoresByRunId({ runId: experimentId, page, perPage });
        allScores.push(...response.scores);
        if (!response.pagination.hasMore) break;
        page++;
      }

      const grouped: Record<string, ClientScoreRowData[]> = {};
      for (const row of allScores) {
        if (!grouped[row.entityId]) {
          grouped[row.entityId] = [];
        }
        grouped[row.entityId].push(row);
      }
      return grouped;
    },
    refetchInterval: experimentStatus === 'running' || experimentStatus === 'pending' ? 2000 : false,
    ...queryOptions,
  });
};
