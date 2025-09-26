import { WorkflowWatchResult } from '@mastra/client-js';

import { useMastraClient } from '@mastra/react';
import { usePlaygroundStore } from '@/store/playground-store';
import { useQuery } from '@tanstack/react-query';

export type ExtendedWorkflowWatchResult = WorkflowWatchResult & {
  sanitizedOutput?: string | null;
  sanitizedError?: {
    message: string;
    stack?: string;
  } | null;
};

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
