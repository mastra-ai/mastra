import { useMutation, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '../api/keys';
import {
  createAgentControllerClient,
  requireAgentControllerSession,
} from '../../web/ui/domains/chat/services/agentControllerClient';

interface AgentControllerThreadMutationArgs {
  agentControllerId: string;
  resourceId: string;
  projectPath?: string;
  baseUrl?: string;
  enabled?: boolean;
}

function useThreadMutationInvalidation({
  agentControllerId,
  resourceId,
  projectPath,
}: AgentControllerThreadMutationArgs) {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({
      queryKey: queryKeys.agentControllerThreads(agentControllerId, resourceId, projectPath),
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

export function useDeleteAgentControllerThreadMutation(args: AgentControllerThreadMutationArgs) {
  const { session } = createAgentControllerClient(args);
  const invalidateThreads = useThreadMutationInvalidation(args);

  return useMutation({
    mutationFn: (threadId: string) => requireAgentControllerSession(session).deleteThread(threadId),
    onSuccess: invalidateThreads,
  });
}

export function useRenameAgentControllerThreadMutation(args: AgentControllerThreadMutationArgs) {
  const { session } = createAgentControllerClient(args);
  const invalidateThreads = useThreadMutationInvalidation(args);

  return useMutation({
    mutationFn: ({ threadId, title }: { threadId: string; title: string }) =>
      requireAgentControllerSession(session).renameThread(threadId, title),
    onSuccess: invalidateThreads,
  });
}

export function useCloneAgentControllerThreadMutation(args: AgentControllerThreadMutationArgs) {
  const { session } = createAgentControllerClient(args);
  const invalidateThreads = useThreadMutationInvalidation(args);

  return useMutation({
    mutationFn: (options?: { sourceThreadId?: string; title?: string }) =>
      requireAgentControllerSession(session).cloneThread(options),
    onSuccess: invalidateThreads,
  });
}

export function useSwitchAgentControllerThreadMutation(args: AgentControllerThreadMutationArgs) {
  const { agentControllerId, resourceId, projectPath } = args;
  const queryClient = useQueryClient();
  const { session } = createAgentControllerClient(args);

  return useMutation({
    mutationFn: async (threadId: string) => {
      await requireAgentControllerSession(session).switchThread(threadId);
      return requireAgentControllerSession(session).state();
    },
    onSuccess: state => {
      queryClient.setQueryData(
        queryKeys.agentControllerConnectionState(agentControllerId, resourceId, projectPath),
        state,
      );
    },
  });
}
