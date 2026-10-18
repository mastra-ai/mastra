import type { ClientScoreRowData, DatasetExperimentResult, MastraClient } from '@mastra/client-js';
import type { ExperimentStatus } from '@mastra/core/storage';
import { queryOptions as tanstackQueryOptions, useInfiniteQuery, useQueries, useQuery } from '@tanstack/react-query';
import type {
  InfiniteData,
  QueryKey,
  UseInfiniteQueryResult,
  UseQueryOptions,
  UseQueryResult,
} from '@tanstack/react-query';
import { useEffect } from 'react';
import { useMastraClient } from '../../mastra-client-context';
import { useCombineByIds } from '../shared/combine-by-ids';
import type { ExperimentQueriesResult } from '../shared/combine-by-ids';
import type { MastraInfiniteQueryOptions, MastraQueryOptions } from '../shared/query-options';

export type { ExperimentQueriesResult } from '../shared/combine-by-ids';
import { useInView } from '../shared/use-in-view';

type DatasetExperimentResponse = Awaited<ReturnType<MastraClient['getDatasetExperiment']>>;
type ExperimentResultsPage = Awaited<ReturnType<MastraClient['listDatasetExperimentResults']>>;
type ExperimentScoresByEntity = Record<string, ClientScoreRowData[]>;
type DatasetExperimentQueryKey = string[];
type ExperimentStatusQueryKey = (string | undefined)[];

const POLL_INTERVAL_MS = 2000;
const RESULTS_PER_PAGE = 100;
const SCORES_PER_PAGE = 100;

const isInProgress = (status: string | undefined) => status === 'running' || status === 'pending';

/**
 * Key, fetcher and polling policy of the `dataset-experiment` query, shared by the single and
 * multi-experiment hooks so they hit the same cache entry.
 * Polls every 2 seconds while the experiment is 'running' or 'pending'.
 */
export const datasetExperimentQueryOptions = (
  client: MastraClient,
  datasetId: string,
  experimentId: string,
): UseQueryOptions<DatasetExperimentResponse, Error, DatasetExperimentResponse, DatasetExperimentQueryKey> =>
  tanstackQueryOptions({
    queryKey: ['dataset-experiment', datasetId, experimentId],
    queryFn: () => client.getDatasetExperiment(datasetId, experimentId),
    gcTime: 0,
    staleTime: 0,
    refetchInterval: query => (isInProgress(query.state.data?.status) ? POLL_INTERVAL_MS : false),
  });

/**
 * Key and fetcher of the `dataset-experiment-scores` query: every score of an experiment, across all
 * pages, grouped by dataset item id. Polls every 2 seconds while `experimentStatus` is in progress.
 */
export const experimentScoresQueryOptions = (
  client: MastraClient,
  experimentId: string,
  experimentStatus: ExperimentStatus | undefined,
): UseQueryOptions<ExperimentScoresByEntity, Error, ExperimentScoresByEntity, ExperimentStatusQueryKey> =>
  tanstackQueryOptions({
    queryKey: ['dataset-experiment-scores', experimentId, experimentStatus],
    queryFn: async (): Promise<ExperimentScoresByEntity> => {
      const allScores: ClientScoreRowData[] = [];
      let page = 0;

      while (true) {
        const response = await client.listScoresByRunId({ runId: experimentId, page, perPage: SCORES_PER_PAGE });
        allScores.push(...response.scores);
        if (!response.pagination.hasMore) break;
        page++;
      }

      const grouped: ExperimentScoresByEntity = {};
      for (const row of allScores) {
        (grouped[row.entityId] ??= []).push(row);
      }
      return grouped;
    },
    refetchInterval: isInProgress(experimentStatus) ? POLL_INTERVAL_MS : false,
  });

/**
 * Key and fetcher of the `dataset-experiment-results-all` query: every result of an experiment, across
 * all pages. Polls every 2 seconds while `experimentStatus` is in progress.
 */
export const allDatasetExperimentResultsQueryOptions = (
  client: MastraClient,
  datasetId: string,
  experimentId: string,
  experimentStatus: ExperimentStatus | undefined,
): UseQueryOptions<DatasetExperimentResult[], Error, DatasetExperimentResult[], ExperimentStatusQueryKey> =>
  tanstackQueryOptions({
    queryKey: ['dataset-experiment-results-all', datasetId, experimentId, experimentStatus],
    queryFn: async (): Promise<DatasetExperimentResult[]> => {
      const allResults: DatasetExperimentResult[] = [];
      let page = 0;

      while (true) {
        const response = await client.listDatasetExperimentResults(datasetId, experimentId, {
          page,
          perPage: RESULTS_PER_PAGE,
        });
        allResults.push(...response.results);
        if (!response.pagination.hasMore || response.results.length === 0) break;
        page++;
      }

      return allResults;
    },
    refetchInterval: isInProgress(experimentStatus) ? POLL_INTERVAL_MS : false,
  });

/** An experiment id plus its status, which drives polling of its dependent queries. */
export interface ExperimentRef {
  id: string;
  status?: ExperimentStatus;
}

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
  queryOptions?: MastraQueryOptions<DatasetExperimentResponse, TData, DatasetExperimentQueryKey>;
}): UseQueryResult<TData, Error> => {
  const client = useMastraClient();
  const { queryKey, queryFn, gcTime, staleTime, refetchInterval } = datasetExperimentQueryOptions(
    client,
    datasetId,
    experimentId,
  );
  return useQuery<DatasetExperimentResponse, Error, TData, DatasetExperimentQueryKey>({
    queryKey,
    queryFn,
    gcTime,
    staleTime,
    refetchInterval,
    ...queryOptions,
  });
};

/**
 * Fetches several experiments of one dataset in parallel, each polled while it runs.
 * The server 404s an experiment that does not belong to `datasetId`, which surfaces as `error`.
 */
export const useDatasetExperimentsQueries = ({
  datasetId,
  experimentIds,
}: {
  datasetId: string;
  experimentIds: string[];
}): ExperimentQueriesResult<DatasetExperimentResponse> => {
  const client = useMastraClient();
  const combine = useCombineByIds<DatasetExperimentResponse>(experimentIds);
  return useQueries({
    queries: experimentIds.map(id => datasetExperimentQueryOptions(client, datasetId, id)),
    combine,
  });
};

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
    refetchInterval: isInProgress(experimentStatus) ? POLL_INTERVAL_MS : false,
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
 * Fetches every result (all pages) of several experiments of one dataset in parallel.
 * Each experiment is polled while its `status` is in progress.
 */
export const useAllDatasetExperimentResultsQueries = ({
  datasetId,
  experiments,
}: {
  datasetId: string;
  experiments: ExperimentRef[];
}): ExperimentQueriesResult<DatasetExperimentResult[]> => {
  const client = useMastraClient();
  const combine = useCombineByIds<DatasetExperimentResult[]>(experiments.map(experiment => experiment.id));
  return useQueries({
    queries: experiments.map(experiment =>
      allDatasetExperimentResultsQueryOptions(client, datasetId, experiment.id, experiment.status),
    ),
    combine,
  });
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
  queryOptions?: MastraQueryOptions<ExperimentScoresByEntity, TData, ExperimentStatusQueryKey>;
}): UseQueryResult<TData, Error> => {
  const client = useMastraClient();
  const { queryKey, queryFn, refetchInterval } = experimentScoresQueryOptions(client, experimentId, experimentStatus);
  return useQuery<ExperimentScoresByEntity, Error, TData, ExperimentStatusQueryKey>({
    queryKey,
    queryFn,
    refetchInterval,
    ...queryOptions,
  });
};

/**
 * Fetches every score of several experiments in parallel, each grouped by dataset item id.
 * Each experiment is polled while its `status` is in progress.
 */
export const useScoresByExperimentIdsQueries = ({
  experiments,
}: {
  experiments: ExperimentRef[];
}): ExperimentQueriesResult<ExperimentScoresByEntity> => {
  const client = useMastraClient();
  const combine = useCombineByIds<ExperimentScoresByEntity>(experiments.map(experiment => experiment.id));
  return useQueries({
    queries: experiments.map(experiment => experimentScoresQueryOptions(client, experiment.id, experiment.status)),
    combine,
  });
};
