import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';
import type { ReviewItem } from '../components/review-item-card';
import { useDatasetExperiments } from '@/domains/datasets/hooks/use-dataset-experiments';

/**
 * Loads persisted review items (status='needs-review') across ALL experiments for a dataset.
 */
export const useDatasetReviewItems = (datasetId: string) => {
  const client = useMastraClient();
  const { data: experimentsData } = useDatasetExperiments(datasetId);
  const experiments = experimentsData?.experiments;

  return useQuery({
    queryKey: ['dataset-review-items', datasetId, experiments?.map(e => e.id)],
    queryFn: async () => {
      if (!experiments || experiments.length === 0) return [] as ReviewItem[];

      const allResults = await Promise.all(
        experiments.map(async exp => {
          if (!exp.datasetId) return [];
          try {
            const { results } = await client.listDatasetExperimentResults(exp.datasetId, exp.id);
            return results
              .filter(r => r.status === 'needs-review')
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
                comment: '',
              }));
          } catch {
            return [];
          }
        }),
      );

      return allResults.flat() as ReviewItem[];
    },
    enabled: Boolean(datasetId) && Boolean(experiments) && experiments!.length > 0,
    refetchOnWindowFocus: false,
  });
};

/**
 * Loads completed review items (status='complete') across ALL experiments for a dataset.
 */
export const useDatasetCompletedItems = (datasetId: string) => {
  const client = useMastraClient();
  const { data: experimentsData } = useDatasetExperiments(datasetId);
  const experiments = experimentsData?.experiments;

  return useQuery({
    queryKey: ['dataset-completed-items', datasetId, experiments?.map(e => e.id)],
    queryFn: async () => {
      if (!experiments || experiments.length === 0) return [] as ReviewItem[];

      const allResults = await Promise.all(
        experiments.map(async exp => {
          if (!exp.datasetId) return [];
          try {
            const { results } = await client.listDatasetExperimentResults(exp.datasetId, exp.id);
            return results
              .filter(r => r.status === 'complete')
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
                comment: '',
              }));
          } catch {
            return [];
          }
        }),
      );

      return allResults.flat() as ReviewItem[];
    },
    enabled: Boolean(datasetId) && Boolean(experiments) && experiments!.length > 0,
    refetchOnWindowFocus: false,
  });
};
