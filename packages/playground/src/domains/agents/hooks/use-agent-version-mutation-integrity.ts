import { skipToken, useQuery } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';

import { agentVersionQueryKeys } from './agent-version-query-keys';

export type AgentVersionMutationIntegrityBlock = {
  message: string;
};

export type AgentVersionIntegrityRecovery = {
  isBlocked: boolean;
  isRetrying: boolean;
  error?: string;
  onRetry: () => void;
};

/** Subscribes mutation surfaces to the shared integrity latch for one agent. */
export const useAgentVersionMutationIntegrity = (agentId: string) => {
  const query = useQuery<AgentVersionMutationIntegrityBlock>({
    queryKey: agentVersionQueryKeys.mutationIntegrity(agentId),
    queryFn: skipToken,
  });

  return {
    isBlocked: query.data !== undefined,
    message: query.data?.message,
  };
};

/** Clears the latch only after a caller has explicitly refreshed every authoritative pointer view. */
export const clearAgentVersionMutationIntegrity = (queryClient: QueryClient, agentId: string): void => {
  queryClient.removeQueries({ queryKey: agentVersionQueryKeys.mutationIntegrity(agentId), exact: true });
};
