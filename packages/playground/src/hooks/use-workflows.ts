import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';
import { usePlaygroundStore } from '@/store/playground-store';

export const useWorkflow = (workflowId?: string) => {
  const client = useMastraClient();
  const { requestContext } = usePlaygroundStore();
  return useQuery({
    queryKey: ['workflow', workflowId],
    queryFn: () => (workflowId ? client.getWorkflow(workflowId).details(requestContext) : null),
    enabled: Boolean(workflowId),
    retry: false,
    refetchOnWindowFocus: false,
    throwOnError: false,
  });
};
