import { useMutation, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '../api/keys';
import { agentControllerSessionMutationScope, agentControllerSwitchThreadMutationKey } from './agentControllerMutationArgs';
import {
  createAgentControllerClient,
  requireAgentControllerSession,
} from '../../web/ui/domains/chat/services/agentControllerClient';

interface AgentControllerThreadMutationArgs {
  agentControllerId: string;
  resourceId: string;
  scope?: string;
  baseUrl?: string;
  enabled?: boolean;
}

function useThreadMutationInvalidation({ agentControllerId, resourceId, scope }: AgentControllerThreadMutationArgs) {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({
      queryKey: queryKeys.agentControllerThreads(agentControllerId, resourceId, scope),
      exact: true,
    });
}

export function useCreateAgentControllerThreadMutation(args: AgentControllerThreadMutationArgs) {
  const { session } = createAgentControllerClient(args);
  const invalidateThreads = useThreadMutationInvalidation(args);

  return useMutation({
    mutationFn: (title?: string) => requireAgentControllerSession(session).createThread(title),
    onSuccess: invalidateThreads,
  });
}

export function useSwitchAgentControllerThreadMutation(args: AgentControllerThreadMutationArgs) {
  const { agentControllerId, resourceId, scope } = args;
  const queryClient = useQueryClient();
  const { session } = createAgentControllerClient(args);

  return useMutation({
    mutationKey: agentControllerSwitchThreadMutationKey(args),
    scope: agentControllerSessionMutationScope(args),
    mutationFn: async (threadId: string) => {
      await requireAgentControllerSession(session).switchThread(threadId);
      return requireAgentControllerSession(session).state();
    },
    onSuccess: state => {
      queryClient.setQueryData(queryKeys.agentControllerConnectionState(agentControllerId, resourceId, scope), state);
    },
  });
}
