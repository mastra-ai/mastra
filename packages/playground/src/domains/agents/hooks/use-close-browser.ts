import { useMastraClient } from '@mastra/react';
import { useMutation } from '@tanstack/react-query';

interface CloseBrowserParams {
  agentId: string;
  threadId?: string;
}

/**
 * Mutation hook for closing an agent's browser session.
 */
export function useCloseBrowser() {
  const client = useMastraClient();

  return useMutation<{ success: boolean }, Error, CloseBrowserParams>({
    mutationFn: ({ agentId, threadId }) => client.getAgent(agentId).closeBrowser(threadId),
    onError: err => {
      console.error('[useCloseBrowser] Error closing browser:', err);
    },
  });
}
