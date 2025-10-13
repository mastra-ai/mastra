import { useQuery } from '@tanstack/react-query';
import { useMastraClient } from '@mastra/react';
import { useWorkflows } from './use-workflows';

export interface WorkflowRunWithMetadata {
  workflowId: string;
  workflowName: string;
  runId: string;
  status: string;
  timestamp?: string;
  snapshot?: any;
}

export const useAllWorkflowRuns = () => {
  const { data: workflows, isLoading: isLoadingWorkflows } = useWorkflows();
  const client = useMastraClient();

  return useQuery({
    queryKey: ['all-workflow-runs'],
    queryFn: async () => {
      if (!workflows) return [];

      const allRuns: WorkflowRunWithMetadata[] = [];

      // Fetch runs for each workflow
      const workflowEntries = Object.entries(workflows);

      await Promise.all(
        workflowEntries.map(async ([workflowId, workflow]) => {
          try {
            const runsData = await client.getWorkflow(workflowId).runs({ limit: 50 });
            const runs = runsData?.runs || [];

            runs.forEach(run => {
              allRuns.push({
                workflowId,
                workflowName: workflow.name || workflowId,
                runId: run.runId,
                status: typeof run.snapshot === 'object' ? run.snapshot.status || 'unknown' : 'unknown',
                timestamp: typeof run.snapshot === 'object' ? run.snapshot.timestamp : undefined,
                snapshot: run.snapshot,
              });
            });
          } catch (error) {
            console.error(`Error fetching runs for workflow ${workflowId}:`, error);
          }
        }),
      );

      // Sort by timestamp, most recent first
      return allRuns.sort((a, b) => {
        if (!a.timestamp) return 1;
        if (!b.timestamp) return -1;
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      });
    },
    enabled: !isLoadingWorkflows && !!workflows,
    refetchInterval: 10000, // Refetch every 10 seconds
    staleTime: 5000,
  });
};
