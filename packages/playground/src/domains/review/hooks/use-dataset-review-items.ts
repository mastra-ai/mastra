import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';
import type { ReviewItem } from '../components/review-item-card';
import { useExperimentsForDatasetFilter } from '@/domains/experiments/hooks/use-experiments-for-dataset-filter';

type ReviewStatus = 'needs-review' | 'complete';

export interface ReviewItemsOptions {
  /** When set, only this experiment's results are loaded; otherwise every experiment in the project. */
  experimentId?: string;
}

/**
 * Loads experiment results with the given review status, across the project or scoped to one experiment.
 */
const useReviewItemsByStatus = (status: ReviewStatus, experimentId: string | undefined) => {
  const client = useMastraClient();
  const { data: experimentsData, isLoading: isLoadingExperiments } = useExperimentsForDatasetFilter(undefined);
  const experiments = experimentsData?.experiments;
  const scopedExperiments = experimentId ? experiments?.filter(exp => exp.id === experimentId) : experiments;

  const query = useQuery({
    queryKey: ['review-items', status, experimentId ?? 'all', scopedExperiments?.map(e => e.id)],
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
                comment: r.comment ?? '',
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
  });

  // The results query is disabled until experiments arrive, so its own `isLoading`
  // is false during that window; surface the upstream load to avoid an empty flash.
  return { ...query, isLoading: query.isLoading || isLoadingExperiments };
};

/** Loads persisted review items (status='needs-review'), project-wide or for one experiment. */
export const useReviewItems = ({ experimentId }: ReviewItemsOptions = {}) =>
  useReviewItemsByStatus('needs-review', experimentId);

/** Loads completed review items (status='complete'), project-wide or for one experiment. */
export const useCompletedItems = ({ experimentId }: ReviewItemsOptions = {}) =>
  useReviewItemsByStatus('complete', experimentId);
