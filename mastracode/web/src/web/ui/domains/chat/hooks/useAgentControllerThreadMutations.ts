import { useMutation, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '../../../../../shared/api/keys';
import { createAgentControllerClient, requireAgentControllerSession } from '../services/agentControllerClient';

interface AgentControllerThreadMutationArgs {
  agentControllerId: string;
  resourceId: string;
  projectPath?: string;
  baseUrl?: string;
  enabled?: boolean;
}

function toClientArgs({
  agentControllerId,
  resourceId,
  projectPath,
  baseUrl,
  enabled,
}: AgentControllerThreadMutationArgs) {
  return { agentControllerId, resourceId, scope: projectPath, baseUrl, enabled };
}

function useThreadMutationInvalidation({
  agentControllerId,
  resourceId,
  projectPath,
}: AgentControllerThreadMutationArgs) {
  const queryClient = useQueryClient();
  return async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: queryKeys.agentControllerThreads(agentControllerId, resourceId, projectPath),
      }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.agentControllerSettings(agentControllerId, resourceId, projectPath),
      }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.agentControllerSession(agentControllerId, resourceId, projectPath),
        exact: true,
      }),
    ]);
  };
}

export function useCreateAgentControllerThreadMutation(args: AgentControllerThreadMutationArgs) {
  const { session } = createAgentControllerClient(toClientArgs(args));
  const invalidateThreads = useThreadMutationInvalidation(args);

  return useMutation({
    mutationFn: (title?: string) => requireAgentControllerSession(session).createThread(title),
    onSuccess: invalidateThreads,
  });
}

export function useDeleteAgentControllerThreadMutation(args: AgentControllerThreadMutationArgs) {
  const { session } = createAgentControllerClient(toClientArgs(args));
  const invalidateThreads = useThreadMutationInvalidation(args);

  return useMutation({
    mutationFn: (threadId: string) => requireAgentControllerSession(session).deleteThread(threadId),
    onSuccess: invalidateThreads,
  });
}

export function useRenameAgentControllerThreadMutation(args: AgentControllerThreadMutationArgs) {
  const { session } = createAgentControllerClient(toClientArgs(args));
  const invalidateThreads = useThreadMutationInvalidation(args);

  return useMutation({
    mutationFn: ({ threadId, title }: { threadId: string; title: string }) =>
      requireAgentControllerSession(session).renameThread(threadId, title),
    onSuccess: invalidateThreads,
  });
}

export function useCloneAgentControllerThreadMutation(args: AgentControllerThreadMutationArgs) {
  const { session } = createAgentControllerClient(toClientArgs(args));
  const invalidateThreads = useThreadMutationInvalidation(args);

  return useMutation({
    mutationFn: (options?: { sourceThreadId?: string; title?: string }) =>
      requireAgentControllerSession(session).cloneThread(options),
    onSuccess: invalidateThreads,
  });
}

export function useSwitchAgentControllerThreadMutation(args: AgentControllerThreadMutationArgs) {
  const { session } = createAgentControllerClient(toClientArgs(args));

  return useMutation({
    mutationFn: async (threadId: string) => {
      await requireAgentControllerSession(session).switchThread(threadId);
      return requireAgentControllerSession(session).state();
    },
  });
}
