import { useQuery } from '@tanstack/react-query';
import { useMastraClient } from '../../mastra-client-context';

export const useWorkflow = (workflowId?: string, requestContext?: Record<string, any>) => {
  const client = useMastraClient();
  return useQuery({
    queryKey: ['workflow', workflowId],
    queryFn: () => (workflowId ? client.getWorkflow(workflowId).details(requestContext) : null),
    enabled: Boolean(workflowId),
    retry: false,
    refetchOnWindowFocus: false,
    throwOnError: false,
  });
};
