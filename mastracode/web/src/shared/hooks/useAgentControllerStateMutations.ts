import { useMutation, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '../api/keys';
import type { AgentControllerMutationArgs } from './agentControllerMutationArgs';
import {
  createAgentControllerClient,
  requireAgentControllerSession,
} from '../../web/ui/domains/chat/services/agentControllerClient';

export function useSetAgentControllerStateMutation({
  agentControllerId,
  resourceId,
  scope,
  baseUrl = '',
  enabled = true,
}: AgentControllerMutationArgs) {
  const queryClient = useQueryClient();
  const { session } = createAgentControllerClient({ agentControllerId, resourceId, scope, baseUrl, enabled });

  return useMutation({
    mutationFn: (updates: Record<string, unknown>) => requireAgentControllerSession(session).setState(updates),
    onSuccess: async (_data, updates) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.agentControllerConnectionState(agentControllerId, resourceId, scope),
          exact: true,
        }),
        'settings' in updates
          ? queryClient.invalidateQueries({
              queryKey: queryKeys.agentControllerSettings(agentControllerId, resourceId, scope),
              exact: true,
            })
          : Promise.resolve(),
      ]);
    },
  });
}

export function useSwitchAgentControllerModeMutation(args: AgentControllerMutationArgs) {
  const { session } = createAgentControllerClient(args);

  return useMutation({
    mutationFn: (modeId: string) => requireAgentControllerSession(session).switchMode(modeId),
  });
}

export function useSwitchAgentControllerModelMutation(args: AgentControllerMutationArgs) {
  const queryClient = useQueryClient();
  const { session } = createAgentControllerClient(args);

  return useMutation({
    mutationFn: (modelId: string) => requireAgentControllerSession(session).switchModel(modelId),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.agentControllerConnectionState(args.agentControllerId, args.resourceId, args.scope),
        exact: true,
      }),
  });
}
