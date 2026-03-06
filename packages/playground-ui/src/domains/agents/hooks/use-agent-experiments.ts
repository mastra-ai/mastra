import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';
import { useDatasets } from '@/domains/datasets/hooks/use-datasets';

interface AgentExperiment {
  id: string;
  datasetId: string;
  datasetName: string;
  targetType: string;
  targetId: string;
  status: string;
  totalItems: number;
  succeededCount: number;
  failedCount: number;
  startedAt: string | Date;
  completedAt: string | Date | null;
}

/**
 * Hook to fetch all experiments targeting a specific agent across all datasets.
 * Fetches experiments from each dataset and filters by targetId === agentId.
 */
export const useAgentExperiments = (agentId: string) => {
  const client = useMastraClient();
  const { data: datasetsData } = useDatasets();
  const datasets = datasetsData?.datasets ?? [];

  return useQuery({
    queryKey: ['agent-experiments', agentId, datasets.map(d => d.id)],
    queryFn: async () => {
      if (datasets.length === 0) return [] as AgentExperiment[];

      const results = await Promise.all(
        datasets.map(async dataset => {
          try {
            const response = await client.listDatasetExperiments(dataset.id);
            return response.experiments
              .filter(exp => exp.targetType === 'agent' && exp.targetId === agentId)
              .map(exp => ({
                ...exp,
                datasetId: dataset.id,
                datasetName: dataset.name,
              }));
          } catch {
            return [];
          }
        }),
      );

      return results
        .flat()
        .toSorted((a, b) => {
          const dateA = a.startedAt ? new Date(a.startedAt as string).getTime() : 0;
          const dateB = b.startedAt ? new Date(b.startedAt as string).getTime() : 0;
          return dateB - dateA;
        }) as AgentExperiment[];
    },
    enabled: Boolean(agentId) && datasets.length > 0,
    refetchInterval: query => {
      const data = query.state.data;
      if (!data) return false;
      const hasRunning = data.some(exp => exp.status === 'running' || exp.status === 'pending');
      return hasRunning ? 3000 : false;
    },
  });
};

export type { AgentExperiment };
