import { useMutation, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '../../../../../shared/api/keys';
import { createAgentControllerClient } from '../services/agentControllerClient';

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
  return async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: queryKeys.agentControllerThreads(agentControllerId, resourceId, projectPath),
      }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.agentControllerSettings(agentControllerId, resourceId),
      }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.agentControllerSession(agentControllerId, resourceId),
        exact: true,
      }),
    ]);
  };
}

export function useCreateAgentControllerThreadMutation(args: AgentControllerThreadMutationArgs) {
  const { session } = createAgentControllerClient(args);
  const invalidateThreads = useThreadMutationInvalidation(args);

  return useMutation({
    mutationFn: (title?: string) => session!.createThread(title),
    onSuccess: invalidateThreads,
  });
}

export function useDeleteAgentControllerThreadMutation(args: AgentControllerThreadMutationArgs) {
  const { session } = createAgentControllerClient(args);
  const invalidateThreads = useThreadMutationInvalidation(args);

  return useMutation({
    mutationFn: (threadId: string) => session!.deleteThread(threadId),
    onSuccess: invalidateThreads,
  });
}

export function useRenameAgentControllerThreadMutation(args: AgentControllerThreadMutationArgs) {
  const { session } = createAgentControllerClient(args);
  const invalidateThreads = useThreadMutationInvalidation(args);

  return useMutation({
    mutationFn: ({ threadId, title }: { threadId: string; title: string }) => session!.renameThread(threadId, title),
    onSuccess: invalidateThreads,
  });
}

export function useCloneAgentControllerThreadMutation(args: AgentControllerThreadMutationArgs) {
  const { session } = createAgentControllerClient(args);
  const invalidateThreads = useThreadMutationInvalidation(args);

  return useMutation({
    mutationFn: (options?: { sourceThreadId?: string; title?: string }) => session!.cloneThread(options),
    onSuccess: invalidateThreads,
  });
}

export function useSwitchAgentControllerThreadMutation(args: AgentControllerThreadMutationArgs) {
  const { session } = createAgentControllerClient(args);
  const invalidateSession = useThreadMutationInvalidation(args);

  return useMutation({
    mutationFn: async (threadId: string) => {
      await session!.switchThread(threadId);
      return session!.state();
    },
    onSuccess: invalidateSession,
  });
}
