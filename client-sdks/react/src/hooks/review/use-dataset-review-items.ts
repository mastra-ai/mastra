import type { DatasetExperiment, DatasetExperimentResult, MastraClient } from '@mastra/client-js';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import type { InfiniteData, QueryKey, UseInfiniteQueryResult, UseQueryResult } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useMastraClient } from '../../mastra-client-context';
import { listAllExperimentResults } from '../datasets/list-all-experiment-results';
import { useExperimentsForDatasetFilter } from '../experiments';
import type { ExperimentTargetFilter } from '../experiments';
import type { MastraInfiniteQueryOptions, MastraQueryOptions } from '../shared/query-options';
import { useInView } from '../shared/use-in-view';
import type { ReviewItem } from './types';

type ReviewStatus = 'needs-review' | 'complete';

const RESULTS_PER_PAGE = 100;

export interface ReviewItemsOptions extends ExperimentTargetFilter {
  /** When set, only this experiment's results are loaded; otherwise every experiment in the project. */
  experimentId?: string;
  /** Explicit source owned by the caller; an empty list disables discovery too. */
  experiments?: DatasetExperiment[];
  isLoadingExperiments?: boolean;
  /** TanStack overrides spread last into the review-items query. */
  queryOptions?: MastraQueryOptions<ReviewItem[]>;
}

/** The next results page to load, for each experiment that still has matching results. */
export interface ReviewItemsCursor {
  page: number;
  experiments: Array<{ experimentId: string; datasetId: string }>;
}

export interface ReviewItemsPage {
  items: ReviewItem[];
  next?: ReviewItemsCursor;
}

export interface InfiniteReviewItemsOptions extends Omit<ReviewItemsOptions, 'queryOptions'> {
  /** TanStack overrides spread last into the review-items infinite query. */
  queryOptions?: MastraInfiniteQueryOptions<ReviewItemsPage, ReviewItem[], QueryKey, ReviewItemsCursor>;
}

const toReviewItem = (result: DatasetExperimentResult, datasetId: string): ReviewItem => ({
  id: result.id,
  input: result.input,
  output: result.output,
  error: result.error,
  itemId: result.itemId,
  experimentId: result.experimentId,
  datasetId,
  traceId: result.traceId ?? undefined,
  scores: result.scores ? Object.fromEntries(result.scores.map(s => [s.scorerId, s.score ?? 0])) : {},
  tags: result.tags ?? [],
  targetType: result.targetType,
  createdAt: result.createdAt,
  startedAt: result.startedAt,
  completedAt: result.completedAt,
  status: result.status,
  groundTruth: result.groundTruth,
  toolMockReport: result.toolMockReport,
});

const useReviewSource = ({
  experimentId,
  targetType,
  targetId,
  experiments: suppliedExperiments,
  isLoadingExperiments = false,
}: Omit<ReviewItemsOptions, 'queryOptions'>) => {
  const hasSuppliedExperiments = suppliedExperiments !== undefined;
  const { data: experimentsData, isLoading: isDiscoveringExperiments } = useExperimentsForDatasetFilter({
    datasetId: undefined,
    target: { targetType, targetId },
    queryOptions: { enabled: !hasSuppliedExperiments },
  });
  const experiments = hasSuppliedExperiments ? suppliedExperiments : experimentsData?.experiments;
  const scopedExperiments = experimentId ? experiments?.filter(exp => exp.id === experimentId) : experiments;

  return {
    experiments,
    scopedExperiments,
    isLoadingSource: hasSuppliedExperiments ? isLoadingExperiments : isDiscoveringExperiments,
    scopeKey: [
      experimentId ?? 'all',
      hasSuppliedExperiments ? 'supplied' : 'discovered',
      hasSuppliedExperiments ? undefined : targetType || 'all',
      hasSuppliedExperiments ? undefined : targetId || 'all',
      scopedExperiments?.map(e => [e.datasetId, e.id]),
    ],
  };
};

/**
 * Loads experiment results with the given review status, across the project, scoped to a target,
 * or scoped to one experiment.
 */
const useReviewItemsByStatus = (
  status: ReviewStatus,
  { queryOptions, ...source }: ReviewItemsOptions,
): UseQueryResult<ReviewItem[], Error> => {
  const client = useMastraClient();
  const { experiments, scopedExperiments, isLoadingSource, scopeKey } = useReviewSource(source);

  const query = useQuery({
    queryKey: ['review-items', status, ...scopeKey],
    queryFn: async () => {
      if (!scopedExperiments || scopedExperiments.length === 0) return [];

      const allResults = await Promise.all(
        scopedExperiments.map(async exp => {
          const { datasetId } = exp;
          if (!datasetId) return [];
          try {
            const results = await listAllExperimentResults(client, datasetId, exp.id);
            return results.filter(r => r.status === status).map(r => toReviewItem(r, datasetId));
          } catch {
            return [];
          }
        }),
      );

      return allResults.flat();
    },
    enabled: Boolean(experiments),
    refetchOnWindowFocus: false,
    ...queryOptions,
  });

  // The results query is disabled until experiments arrive, so its own `isLoading`
  // is false during that window; surface the upstream load to avoid an empty flash.
  return { ...query, isLoading: query.isLoading || isLoadingSource } as UseQueryResult<ReviewItem[], Error>;
};

/** Loads persisted review items (status='needs-review'), project-wide, per target or for one experiment. */
export const useReviewItems = (options: ReviewItemsOptions = {}) => useReviewItemsByStatus('needs-review', options);

/** Loads completed review items (status='complete'), project-wide, per target or for one experiment. */
export const useCompletedItems = (options: ReviewItemsOptions = {}) => useReviewItemsByStatus('complete', options);

const loadReviewItemsPage = async (
  client: MastraClient,
  status: ReviewStatus,
  { page, experiments }: ReviewItemsCursor,
): Promise<ReviewItemsPage> => {
  const pages = await Promise.all(
    experiments.map(async experiment => {
      try {
        const { results, pagination } = await client.listDatasetExperimentResults(
          experiment.datasetId,
          experiment.experimentId,
          { page, perPage: RESULTS_PER_PAGE, status },
        );
        return { experiment, results, hasMore: pagination.hasMore && results.length > 0 };
      } catch {
        return { experiment, results: [], hasMore: false };
      }
    }),
  );
  const withMore = pages.filter(p => p.hasMore).map(p => p.experiment);

  return {
    // Servers without the `status` filter return every result.
    items: pages.flatMap(({ experiment, results }) =>
      results.filter(r => r.status === status).map(r => toReviewItem(r, experiment.datasetId)),
    ),
    next: withMore.length > 0 ? { page: page + 1, experiments: withMore } : undefined,
  };
};

/**
 * Infinite-scroll review items with the given status. Each page holds the next results page of every
 * scoped experiment that still has matching results.
 */
const useInfiniteReviewItemsByStatus = (
  status: ReviewStatus,
  { queryOptions, ...source }: InfiniteReviewItemsOptions,
): UseInfiniteQueryResult<ReviewItem[], Error> & {
  setEndOfListElement: (element: HTMLDivElement | null) => void;
} => {
  const client = useMastraClient();
  const { experiments, scopedExperiments, isLoadingSource, scopeKey } = useReviewSource(source);
  const { inView: isEndOfListInView, setRef: setEndOfListElement } = useInView();

  const query = useInfiniteQuery({
    queryKey: ['review-items', status, 'infinite', ...scopeKey],
    queryFn: async ({ pageParam }) => {
      let page = await loadReviewItemsPage(client, status, pageParam);
      // An empty page would hide the end-of-list sentinel, so keep reading until something matches.
      while (page.items.length === 0 && page.next) page = await loadReviewItemsPage(client, status, page.next);
      return page;
    },
    initialPageParam: {
      page: 0,
      experiments: (scopedExperiments ?? []).flatMap(exp =>
        exp.datasetId ? [{ experimentId: exp.id, datasetId: exp.datasetId }] : [],
      ),
    },
    getNextPageParam: lastPage => lastPage.next,
    select: (data: InfiniteData<ReviewItemsPage, ReviewItemsCursor>) => data.pages.flatMap(page => page.items),
    enabled: Boolean(experiments),
    refetchOnWindowFocus: false,
    ...queryOptions,
  });

  // Waits for refetches too: `fetchNextPage` would cancel the refresh that follows a status change.
  useEffect(() => {
    if (isEndOfListInView && query.hasNextPage && !query.isFetching) {
      void query.fetchNextPage({ cancelRefetch: false });
    }
  }, [isEndOfListInView, query]);

  return { ...query, isLoading: query.isLoading || isLoadingSource, setEndOfListElement } as UseInfiniteQueryResult<
    ReviewItem[],
    Error
  > & { setEndOfListElement: (element: HTMLDivElement | null) => void };
};

/** Infinite-scroll review items (status='needs-review'), project-wide, per target or for one experiment. */
export const useInfiniteReviewItems = (options: InfiniteReviewItemsOptions = {}) =>
  useInfiniteReviewItemsByStatus('needs-review', options);

/** Infinite-scroll completed review items (status='complete'), project-wide, per target or for one experiment. */
export const useInfiniteCompletedItems = (options: InfiniteReviewItemsOptions = {}) =>
  useInfiniteReviewItemsByStatus('complete', options);
