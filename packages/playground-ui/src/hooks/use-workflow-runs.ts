import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

export const useWorkflowRuns = (workflowId: string, { enabled = true }: { enabled?: boolean } = {}) => {
  const client = useMastraClient();
  return useQuery({
    queryKey: ['workflow-runs', workflowId],
    queryFn: () => client.getWorkflow(workflowId).runs({ limit: 50 }),
    enabled,
    refetchInterval: 5000,
    gcTime: 0,
    staleTime: 0,
  });
};

export const useWorkflowRunExecutionResult = (workflowId: string, runId: string, refetchInterval?: number) => {
  const client = useMastraClient();
  return useQuery({
    queryKey: ['workflow-run-execution-result', workflowId, runId],
    queryFn: () => client.getWorkflow(workflowId).runExecutionResult(runId),
    enabled: Boolean(workflowId && runId),
    gcTime: 0,
    staleTime: 0,
    refetchInterval,
  });
};
