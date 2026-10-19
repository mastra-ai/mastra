import type { AgentControllerThinkingLevel } from '@mastra/client-js';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '../api/keys';
import {
  createAgentControllerClient,
  requireAgentControllerSession,
} from '../ui/domains/chat/services/agentControllerClient';
import type { AgentControllerMutationArgs } from './agentControllerMutationArgs';

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

interface ModelSwitch {
  modelId: string;
  thinkingLevel?: AgentControllerThinkingLevel;
  /** Bind the session to this exact thread first (for a switch that may beat session init). */
  threadId?: string;
}

export function useSwitchAgentControllerModelMutation(args: AgentControllerMutationArgs) {
  const queryClient = useQueryClient();
  const { session } = createAgentControllerClient(args);

  return useMutation({
    mutationFn: ({ modelId, thinkingLevel, threadId }: ModelSwitch) =>
      requireAgentControllerSession(session).switchModel(modelId, { thinkingLevel, threadId }),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.agentControllerConnectionState(args.agentControllerId, args.resourceId, args.scope),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.agentControllerSettings(args.agentControllerId, args.resourceId, args.scope),
          exact: true,
        }),
      ]),
  });
}
