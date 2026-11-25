import type { DatasetExperiment, MastraClient } from '@mastra/client-js';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import type { InfiniteData, QueryKey, UseInfiniteQueryResult, UseQueryResult } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useMastraClient } from '../../mastra-client-context';
import { useExperimentsForDatasetFilter } from '../experiments';
import type { ExperimentTargetFilter } from '../experiments';
import type { MastraInfiniteQueryOptions, MastraQueryOptions } from '../shared/query-options';
import { useInView } from '../shared/use-in-view';
import type { ReviewItem } from './types';

type ReviewStatus = 'needs-review' | 'complete';

export interface ReviewItemsOptions extends ExperimentTargetFilter {
  /** When set, only this experiment's results are loaded; otherwise every experiment in the project. */
  experimentId?: string;
  /** Explicit source owned by the caller; an empty list disables discovery too. */
  experiments?: DatasetExperiment[];
  isLoadingExperiments?: boolean;
  /** TanStack overrides spread last into the review-items query. */
  queryOptions?: MastraQueryOptions<ReviewItem[]>;
}

/**
 * Loads experiment results with the given review status, across the project, scoped to a target,
 * or scoped to one experiment.
 */
const useReviewItemsByStatus = (
  status: ReviewStatus,
  {
    experimentId,
    targetType,
    targetId,
    experiments: suppliedExperiments,
    isLoadingExperiments = false,
    queryOptions,
  }: ReviewItemsOptions,
): UseQueryResult<ReviewItem[], Error> => {
  const client = useMastraClient();
  const hasSuppliedExperiments = suppliedExperiments !== undefined;
  const { data: experimentsData, isLoading: isDiscoveringExperiments } = useExperimentsForDatasetFilter({
    datasetId: undefined,
    target: { targetType, targetId },
    queryOptions: { enabled: !hasSuppliedExperiments },
  });
  const experiments = hasSuppliedExperiments ? suppliedExperiments : experimentsData?.experiments;
  const isLoadingSource = hasSuppliedExperiments ? isLoadingExperiments : isDiscoveringExperiments;
  const scopedExperiments = experimentId ? experiments?.filter(exp => exp.id === experimentId) : experiments;

  const query = useQuery({
    queryKey: [
      'review-items',
      status,
      experimentId ?? 'all',
      hasSuppliedExperiments ? 'supplied' : 'discovered',
      hasSuppliedExperiments ? undefined : targetType || 'all',
      hasSuppliedExperiments ? undefined : targetId || 'all',
      scopedExperiments?.map(e => [e.datasetId, e.id]),
    ],
    queryFn: async () => {
      if (!scopedExperiments || scopedExperiments.length === 0) return [] as ReviewItem[];

      const allResults = await Promise.all(
        scopedExperiments.map(async exp => {
          if (!exp.datasetId) return [];
          try {
            const { results } = await client.listDatasetExperimentResults(exp.datasetId, exp.id);
            return results
              .filter(r => r.status === status)
              .map(r => ({
                id: r.id,
                input: r.input,
                output: r.output,
                error: r.error,
                itemId: r.itemId,
                experimentId: r.experimentId,
                datasetId: exp.datasetId ?? undefined,
                traceId: r.traceId ?? undefined,
                scores: r.scores ? Object.fromEntries(r.scores.map(s => [s.scorerId, s.score ?? 0])) : {},
                tags: r.tags ?? [],
                targetType: r.targetType,
                createdAt: r.createdAt,
                startedAt: r.startedAt,
                completedAt: r.completedAt,
                status: r.status,
                groundTruth: r.groundTruth,
                toolMockReport: r.toolMockReport,
              }));
          } catch {
            return [];
          }
        }),
      );

      return allResults.flat() as ReviewItem[];
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

const RESULTS_PER_PAGE = 100;

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
      results
        .filter(r => r.status === status)
        .map(r => ({
          id: r.id,
          input: r.input,
          output: r.output,
          error: r.error,
          itemId: r.itemId,
          experimentId: r.experimentId,
          datasetId: experiment.datasetId,
          traceId: r.traceId ?? undefined,
          scores: r.scores ? Object.fromEntries(r.scores.map(s => [s.scorerId, s.score ?? 0])) : {},
          tags: r.tags ?? [],
          targetType: r.targetType,
          createdAt: r.createdAt,
          startedAt: r.startedAt,
          completedAt: r.completedAt,
          status: r.status,
          groundTruth: r.groundTruth,
          toolMockReport: r.toolMockReport,
        })),
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
  {
    experimentId,
    targetType,
    targetId,
    experiments: suppliedExperiments,
    isLoadingExperiments = false,
    queryOptions,
  }: InfiniteReviewItemsOptions,
): UseInfiniteQueryResult<ReviewItem[], Error> & {
  setEndOfListElement: (element: HTMLDivElement | null) => void;
} => {
  const client = useMastraClient();
  const { inView: isEndOfListInView, setRef: setEndOfListElement } = useInView();
  const hasSuppliedExperiments = suppliedExperiments !== undefined;
  const { data: experimentsData, isLoading: isDiscoveringExperiments } = useExperimentsForDatasetFilter({
    datasetId: undefined,
    target: { targetType, targetId },
    queryOptions: { enabled: !hasSuppliedExperiments },
  });
  const experiments = hasSuppliedExperiments ? suppliedExperiments : experimentsData?.experiments;
  const isLoadingSource = hasSuppliedExperiments ? isLoadingExperiments : isDiscoveringExperiments;
  const scopedExperiments = experimentId ? experiments?.filter(exp => exp.id === experimentId) : experiments;

  const query = useInfiniteQuery({
    queryKey: [
      'review-items',
      status,
      'infinite',
      experimentId ?? 'all',
      hasSuppliedExperiments ? 'supplied' : 'discovered',
      hasSuppliedExperiments ? undefined : targetType || 'all',
      hasSuppliedExperiments ? undefined : targetId || 'all',
      scopedExperiments?.map(e => [e.datasetId, e.id]),
    ],
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
