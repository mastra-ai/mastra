import { useMutation, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '../api/keys';
import {
  createAgentControllerClient,
  requireAgentControllerSession,
} from '../ui/domains/chat/services/agentControllerClient';

interface AgentControllerThreadMutationArgs {
  agentControllerId: string;
  sessionId: string;
  baseUrl?: string;
  enabled?: boolean;
}

function useThreadMutationInvalidation({ agentControllerId, sessionId }: AgentControllerThreadMutationArgs) {
  const queryClient = useQueryClient();
  return () =>
    // Prefix match: the session's thread lists are keyed further by their tag filter.
    queryClient.invalidateQueries({ queryKey: queryKeys.agentControllerThreads(agentControllerId, sessionId) });
}

export const switchThreadMutationKey = (agentControllerId: string, sessionId: string) =>
  ['agent-controller', agentControllerId, sessionId, 'switch-thread'] as const;

export function useCreateAgentControllerThreadMutation(args: AgentControllerThreadMutationArgs) {
  const { session } = createAgentControllerClient(args);
  const invalidateThreads = useThreadMutationInvalidation(args);

  return useMutation({
    mutationFn: (title?: string) => requireAgentControllerSession(session).createThread(title),
    onSuccess: invalidateThreads,
  });
}

export function useSwitchAgentControllerThreadMutation(args: AgentControllerThreadMutationArgs) {
  const { agentControllerId, sessionId } = args;
  const queryClient = useQueryClient();
  const { session } = createAgentControllerClient(args);

  return useMutation({
    mutationKey: switchThreadMutationKey(agentControllerId, sessionId),
    mutationFn: async (threadId: string) => {
      await requireAgentControllerSession(session).switchThread(threadId);
      return requireAgentControllerSession(session).state({ threadId });
    },
    onSuccess: state => {
      queryClient.setQueryData(
        queryKeys.agentControllerConnectionState(agentControllerId, sessionId, state.threadId),
        state,
      );
    },
  });
}
