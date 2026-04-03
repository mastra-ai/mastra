import { useMutation } from '@tanstack/react-query';

interface CloseBrowserParams {
  agentId: string;
  threadId?: string;
}

interface CloseBrowserResponse {
  success: boolean;
}

/**
 * Mutation hook for closing an agent's browser session.
 */
export function useCloseBrowser() {
  return useMutation<CloseBrowserResponse, Error, CloseBrowserParams>({
    mutationFn: async ({ agentId, threadId }) => {
      const response = await fetch(`/api/agents/${agentId}/browser/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId }),
      });

      if (!response.ok) {
        throw new Error(`Failed to close browser: ${response.status}`);
      }

      return { success: true };
    },
    onError: err => {
      console.error('[useCloseBrowser] Error closing browser:', err);
    },
  });
}
