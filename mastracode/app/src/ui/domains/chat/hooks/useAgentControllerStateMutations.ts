import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '#shared/api/keys';

import { createAgentControllerClient, requireAgentControllerSession } from '../services/agentControllerClient';

interface AgentControllerMutationArgs {
  agentControllerId: string;
  resourceId: string;
  baseUrl?: string;
  enabled?: boolean;
}

export function useSetAgentControllerStateMutation({
  agentControllerId,
  resourceId,
  baseUrl = '',
  enabled = true,
}: AgentControllerMutationArgs) {
  const queryClient = useQueryClient();
  const { session } = createAgentControllerClient({ agentControllerId, resourceId, baseUrl, enabled });

  return useMutation({
    mutationFn: (updates: Record<string, unknown>) => requireAgentControllerSession(session).setState(updates),
    onSuccess: async (_data, updates) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.agentControllerSession(agentControllerId, resourceId),
        }),
        'settings' in updates
          ? queryClient.invalidateQueries({
              queryKey: queryKeys.agentControllerSettings(agentControllerId, resourceId),
            })
          : Promise.resolve(),
      ]);
    },
  });
}

export function useSwitchAgentControllerModeMutation(args: AgentControllerMutationArgs) {
  const queryClient = useQueryClient();
  const { session } = createAgentControllerClient(args);

  return useMutation({
    mutationFn: (modeId: string) => requireAgentControllerSession(session).switchMode(modeId),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.agentControllerSession(args.agentControllerId, args.resourceId),
        }),
        queryClient.invalidateQueries({
          queryKey: ['agent-controller', args.agentControllerId, 'connection', args.resourceId],
        }),
      ]),
  });
}

export function useSwitchAgentControllerModelMutation(args: AgentControllerMutationArgs) {
  const queryClient = useQueryClient();
  const { session } = createAgentControllerClient(args);

  return useMutation({
    mutationFn: (modelId: string) => requireAgentControllerSession(session).switchModel(modelId),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.agentControllerSession(args.agentControllerId, args.resourceId),
        }),
        queryClient.invalidateQueries({
          queryKey: ['agent-controller', args.agentControllerId, 'connection', args.resourceId],
        }),
      ]),
  });
}
