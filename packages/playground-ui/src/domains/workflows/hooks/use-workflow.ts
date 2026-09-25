import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

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
