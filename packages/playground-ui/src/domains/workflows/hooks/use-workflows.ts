import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

export const useWorkflows = (options?: { requestContext?: Record<string, any>; enabled?: boolean }) => {
  const client = useMastraClient();
  const requestContext = options?.requestContext;

  return useQuery({
    queryKey: ['workflows', requestContext],
    queryFn: async () => {
      const workflows = await client.listWorkflows(requestContext);
      // Filter out processor workflows - they're shown on the Processors tab instead
      return Object.fromEntries(Object.entries(workflows).filter(([_, workflow]) => !workflow.isProcessorWorkflow));
    },
    enabled: options?.enabled !== false,
  });
};
