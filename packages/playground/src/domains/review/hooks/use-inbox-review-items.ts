import type { MastraClient } from '@mastra/client-js';
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

const PER_PAGE = 100;

async function listAllExperiments(client: MastraClient) {
  const experiments = [];
  let page = 0;
  let hasMore = true;
  while (hasMore) {
    const response = await client.listExperiments({ page, perPage: PER_PAGE });
    experiments.push(...response.experiments);
    hasMore = response.pagination.hasMore;
    page += 1;
  }
  return experiments;
}

async function listAllExperimentResults(client: MastraClient, datasetId: string, experimentId: string) {
  const results = [];
  let page = 0;
  let hasMore = true;
  while (hasMore) {
    const response = await client.listDatasetExperimentResults(datasetId, experimentId, { page, perPage: PER_PAGE });
    results.push(...response.results);
    hasMore = response.pagination.hasMore;
    page += 1;
  }
  return results;
}

export function useInboxDatasetReviewItems() {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['inbox-dataset-review-items'],
    queryFn: async () => {
      const experiments = await listAllExperiments(client);
      const results = await Promise.all(
        experiments.map(async experiment => {
          const datasetId = experiment.datasetId;
          if (!datasetId) return [];

          const experimentResults = await listAllExperimentResults(client, datasetId, experiment.id);
          return experimentResults
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
