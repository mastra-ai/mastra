import { useMastraClient } from '@/contexts/mastra-client-context';
import { useQuery } from '@tanstack/react-query';

export const useWorkflowRuns = (workflowId: string, { enabled = true }: { enabled?: boolean } = {}) => {
  const client = useMastraClient();
  return useQuery({
    queryKey: ['workflow-runs', workflowId],
    queryFn: () => client.getWorkflow(workflowId).runs({ limit: 50 }),
    enabled,
    gcTime: 0,
    staleTime: 0,
  });
};
