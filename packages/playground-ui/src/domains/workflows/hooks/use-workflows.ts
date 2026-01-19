import { useQuery } from '@tanstack/react-query';
import { useMastraClient } from '@mastra/react';
import { usePlaygroundStore } from '@/store/playground-store';

export const useWorkflows = () => {
  const client = useMastraClient();
  const { requestContext } = usePlaygroundStore();

  return useQuery({
    queryKey: ['workflows', requestContext],
    queryFn: async () => {
      const workflows = await client.listWorkflows(requestContext);
      // Filter out processor workflows - they're shown on the Processors tab instead
      return Object.fromEntries(Object.entries(workflows).filter(([_, workflow]) => !workflow.isProcessorWorkflow));
    },
  });
};
