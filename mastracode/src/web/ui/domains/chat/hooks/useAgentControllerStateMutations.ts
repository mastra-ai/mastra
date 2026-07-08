import { useMutation, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '../../../../../shared/api/keys';
import { useAgentControllerClient } from './useAgentControllerClient';

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
  const { session } = useAgentControllerClient({ agentControllerId, resourceId, baseUrl, enabled });

  return useMutation({
    mutationFn: (updates: Record<string, unknown>) => session!.setState(updates),
    onSuccess: async (_data, updates) => {
      if ('settings' in updates) {
        queryClient.setQueryData(
          queryKeys.agentControllerSettings(agentControllerId, resourceId),
          updates.settings,
        );
      }
      await queryClient.invalidateQueries({
        queryKey: queryKeys.agentControllerSession(agentControllerId, resourceId),
      });
    },
  });
}

export function useSwitchAgentControllerModeMutation(args: AgentControllerMutationArgs) {
  const queryClient = useQueryClient();
  const { session } = useAgentControllerClient(args);

  return useMutation({
    mutationFn: (modeId: string) => session!.switchMode(modeId),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.agentControllerSession(args.agentControllerId, args.resourceId),
      }),
  });
}

export function useSwitchAgentControllerModelMutation(args: AgentControllerMutationArgs) {
  const queryClient = useQueryClient();
  const { session } = useAgentControllerClient(args);

  return useMutation({
    mutationFn: (modelId: string) => session!.switchModel(modelId),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.agentControllerSession(args.agentControllerId, args.resourceId),
      }),
  });
}
