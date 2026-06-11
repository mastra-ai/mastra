import type { DatasetExperimentResult } from '@mastra/client-js';
import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

const PER_PAGE = 100;

/**
 * Fetches every per-item result of a replay's source experiment, keyed by
 * itemId — powers the original-vs-replay output comparison. Paginates through
 * all pages (mirrors useReplayAggregates) so a match is never missed because
 * the original lived on a later page. No polling: the source experiment is
 * completed by definition.
 */
export const useSourceExperimentResults = ({
  datasetId,
  sourceExperimentId,
  enabled,
}: {
  datasetId: string;
  sourceExperimentId?: string;
  enabled: boolean;
}) => {
  const client = useMastraClient();
  return useQuery({
    queryKey: ['source-experiment-results', datasetId, sourceExperimentId],
    queryFn: async (): Promise<Map<string, DatasetExperimentResult>> => {
      if (!sourceExperimentId) {
        throw new Error('Source experiment ID is required');
      }
      const resultsByItemId = new Map<string, DatasetExperimentResult>();

      let page = 0;
      while (true) {
        const response = await client.listDatasetExperimentResults(datasetId, sourceExperimentId, {
          page,
          perPage: PER_PAGE,
        });
        for (const result of response.results) {
          resultsByItemId.set(result.itemId, result);
        }
        const total = response.pagination?.total ?? 0;
        if (!response.results.length || (page + 1) * PER_PAGE >= total) break;
        page++;
      }

      return resultsByItemId;
    },
    enabled: enabled && Boolean(datasetId) && Boolean(sourceExperimentId),
  });
};
