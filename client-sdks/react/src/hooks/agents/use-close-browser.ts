import { useMutation } from '@tanstack/react-query';
import { useMastraClient } from '../../mastra-client-context';
import type { MastraMutationOptions } from '../shared/query-options';

interface CloseBrowserParams {
  agentId: string;
  threadId?: string;
}

/**
 * Mutation hook for closing an agent's browser session.
 */
export function useCloseBrowser({
  queryOptions,
}: { queryOptions?: MastraMutationOptions<{ success: boolean }, CloseBrowserParams> } = {}) {
  const client = useMastraClient();

  return useMutation<{ success: boolean }, Error, CloseBrowserParams>({
    mutationFn: ({ agentId, threadId }) => client.getAgent(agentId).closeBrowser(threadId),
    onError: err => {
      console.error('[useCloseBrowser] Error closing browser:', err);
    },
    ...queryOptions,
  });
}
