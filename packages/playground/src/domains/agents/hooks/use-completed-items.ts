import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';
import type { ReviewItem } from '../context/review-queue-context';
import { useAgentExperiments } from './use-agent-experiments';

/**
 * Loads completed review items (status='complete') for auditing.
 */
export const useCompletedItems = (agentId: string) => {
  const client = useMastraClient();
  const { data: experiments } = useAgentExperiments(agentId);

  return useQuery({
    queryKey: ['completed-items', agentId, experiments?.map(e => e.id)],
    queryFn: async () => {
      if (!experiments || experiments.length === 0) return [] as ReviewItem[];

      const allResults = await Promise.all(
        experiments.map(async exp => {
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
                datasetId: exp.datasetId,
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
    enabled: Boolean(agentId) && Boolean(experiments) && experiments!.length > 0,
    refetchOnWindowFocus: false,
  });
};
