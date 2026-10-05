import type { DatasetExperiment } from '@mastra/client-js';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useMastraClient } from '../../mastra-client-context';
import type { MastraQueryOptions } from '../shared/query-options';
import { useExperimentsForDatasetFilter, type ExperimentTargetFilter } from '../experiments';
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
                createdAt: r.createdAt,
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
