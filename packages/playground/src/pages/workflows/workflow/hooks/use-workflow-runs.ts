import { MastraClient } from '@mastra/client-js';
import { useQuery } from '@tanstack/react-query';
import { usePlaygroundStore } from '@mastra/playground-ui';

export interface UseWorkflowRunsProps {
  workflowId: string;
}

export const useWorkflowRuns = ({ workflowId }: UseWorkflowRunsProps) => {
  const { runtimeContext } = usePlaygroundStore();
  return useQuery({
    queryKey: ['workflow-runs', workflowId, JSON.stringify(runtimeContext)],
    queryFn: () => {
      const client = new MastraClient({
        baseUrl: '',
        // only add the header if the baseUrl is not provided i.e it's a local dev environment
        headers: { 'x-mastra-dev-playground': 'true' },
      });
      return client.getWorkflow(workflowId).runs(
        {
          limit: 50,
        },
        runtimeContext,
      );
    },
  });
};
