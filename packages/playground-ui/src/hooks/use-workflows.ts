import { WorkflowWatchResult } from '@mastra/client-js';

import { useMastraClient } from '@/contexts/mastra-client-context';
import { usePlaygroundStore } from '@/store/playground-store';
import { useQuery } from '@tanstack/react-query';

export type ExtendedWorkflowWatchResult = WorkflowWatchResult & {
  sanitizedOutput?: string | null;
  sanitizedError?: {
    message: string;
    stack?: string;
  } | null;
};

export const useWorkflow = (workflowId: string, enabled = true) => {
  const client = useMastraClient();
  const { runtimeContext } = usePlaygroundStore();
  return useQuery({
    queryKey: ['workflow', workflowId],
    queryFn: () => client.getWorkflow(workflowId).details(runtimeContext),
    retry: false,
    refetchOnWindowFocus: false,
    throwOnError: false,
    enabled,
  });
};
