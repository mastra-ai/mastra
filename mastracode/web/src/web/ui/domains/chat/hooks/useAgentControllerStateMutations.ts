import { useMutation, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '../../../../../shared/api/keys';
import { createAgentControllerClient, requireAgentControllerSession } from '../services/agentControllerClient';

interface AgentControllerMutationArgs {
  agentControllerId: string;
  resourceId: string;
  projectPath?: string;
  baseUrl?: string;
  enabled?: boolean;
}

function toClientArgs({ agentControllerId, resourceId, projectPath, baseUrl, enabled }: AgentControllerMutationArgs) {
  return { agentControllerId, resourceId, scope: projectPath, baseUrl, enabled };
}

export function useSetAgentControllerStateMutation(args: AgentControllerMutationArgs) {
  const { agentControllerId, resourceId, projectPath } = args;
  const queryClient = useQueryClient();
  const { session } = createAgentControllerClient(toClientArgs(args));

  return useMutation({
    mutationFn: (updates: Record<string, unknown>) => requireAgentControllerSession(session).setState(updates),
    onSuccess: async (_data, updates) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.agentControllerSession(agentControllerId, resourceId, projectPath),
        }),
        'settings' in updates
          ? queryClient.invalidateQueries({
              queryKey: queryKeys.agentControllerSettings(agentControllerId, resourceId, projectPath),
            })
          : Promise.resolve(),
      ]);
    },
  });
}

export function useSwitchAgentControllerModeMutation(args: AgentControllerMutationArgs) {
  const queryClient = useQueryClient();
  const { session } = createAgentControllerClient(toClientArgs(args));

  return useMutation({
    mutationFn: (modeId: string) => requireAgentControllerSession(session).switchMode(modeId),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.agentControllerSession(args.agentControllerId, args.resourceId, args.projectPath),
        }),
        queryClient.invalidateQueries({
          queryKey: ['agent-controller', args.agentControllerId, 'connection', args.resourceId],
        }),
      ]),
  });
}

export function useSwitchAgentControllerModelMutation(args: AgentControllerMutationArgs) {
  const queryClient = useQueryClient();
  const { session } = createAgentControllerClient(toClientArgs(args));

  return useMutation({
    mutationFn: (modelId: string) => requireAgentControllerSession(session).switchModel(modelId),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.agentControllerSession(args.agentControllerId, args.resourceId, args.projectPath),
        }),
        queryClient.invalidateQueries({
          queryKey: ['agent-controller', args.agentControllerId, 'connection', args.resourceId],
        }),
      ]),
  });
}
