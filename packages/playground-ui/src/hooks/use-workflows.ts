import { useMastraClient } from '@mastra/react';
import { usePlaygroundStore } from '@/store/playground-store';
import { useQuery } from '@tanstack/react-query';

export const useWorkflow = (workflowId?: string) => {
  const client = useMastraClient();
  const { runtimeContext } = usePlaygroundStore();
  return useQuery({
    queryKey: ['workflow', workflowId],
    queryFn: () => (workflowId ? client.getWorkflow(workflowId).details(runtimeContext) : null),
    enabled: Boolean(workflowId),
    retry: false,
    refetchOnWindowFocus: false,
    throwOnError: false,
  });
};
