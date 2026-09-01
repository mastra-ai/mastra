import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

export type InboxDatasetReviewItem = {
  id: string;
  datasetId: string;
  experimentId: string;
  itemId: string;
  traceId?: string;
  input: unknown;
  output: unknown;
};

export function useInboxDatasetReviewItems() {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['inbox-dataset-review-items'],
    queryFn: async () => {
      const { experiments } = await client.listExperiments();
      const results = await Promise.all(
        experiments.map(async experiment => {
          const datasetId = experiment.datasetId;
          if (!datasetId) return [];

          try {
            const response = await client.listDatasetExperimentResults(datasetId, experiment.id);
            return response.results
              .filter(result => result.status === 'needs-review')
              .map(result => ({
                id: result.id,
                datasetId,
                experimentId: experiment.id,
                itemId: result.itemId,
                traceId: result.traceId ?? undefined,
                input: result.input,
                output: result.output,
              }));
          } catch {
            return [];
          }
        }),
      );

      return results.flat();
    },
    refetchInterval: 3000,
    refetchOnWindowFocus: false,
  });
}

export function useInboxDatasetReviewCount({ enabled }: { enabled: boolean }) {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['inbox-dataset-review-count'],
    queryFn: async () => {
      const { counts } = await client.getExperimentReviewSummary();
      return counts.reduce((total, count) => total + count.needsReview, 0);
    },
    enabled,
    refetchInterval: 3000,
  });
}
