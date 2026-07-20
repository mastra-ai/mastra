import { useMutation, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '../api/keys';
import {
  createAgentControllerClient,
  requireAgentControllerSession,
} from '../../web/ui/domains/chat/services/agentControllerClient';

interface AgentControllerMutationArgs {
  agentControllerId: string;
  resourceId: string;
  projectPath?: string;
  baseUrl?: string;
  enabled?: boolean;
}

export function useSetAgentControllerStateMutation({
  agentControllerId,
  resourceId,
  projectPath,
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
          queryKey: queryKeys.agentControllerConnectionState(agentControllerId, resourceId, projectPath),
          exact: true,
        }),
        'settings' in updates
          ? queryClient.invalidateQueries({
              queryKey: queryKeys.agentControllerSettings(agentControllerId, resourceId, projectPath),
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
        queryKey: queryKeys.agentControllerConnectionState(args.agentControllerId, args.resourceId, args.projectPath),
        exact: true,
      }),
  });
}
