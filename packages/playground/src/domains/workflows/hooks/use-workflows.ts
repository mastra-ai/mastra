import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

export const useWorkflows = (options?: { enabled?: boolean }) => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['workflows'],
    queryFn: async () => {
      const workflows = await client.listWorkflows();
      // Filter out processor workflows - they're shown on the Processors tab instead
      return Object.fromEntries(Object.entries(workflows).filter(([_, workflow]) => !workflow.isProcessorWorkflow));
    },
    enabled: options?.enabled !== false,
  });
};
