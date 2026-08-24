import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { AgentControllerSessionSettings } from '@mastra/client-js';

import { queryKeys } from '../api/keys';
import type { AgentControllerMutationArgs } from './agentControllerMutationArgs';
import {
  createAgentControllerClient,
  requireAgentControllerSession,
} from '../ui/domains/chat/services/agentControllerClient';

/**
 * Clears the session's thinking-level override in one atomic server update
 * (`setState({}, { unset: ['thinkingLevel'] })`), verifies the persisted
 * state, and updates the settings cache from what the server returns.
 */
export function useClearAgentControllerThinkingLevelMutation({
  agentControllerId,
  resourceId,
  scope,
  baseUrl = '',
  enabled = true,
}: AgentControllerMutationArgs) {
  const queryClient = useQueryClient();
  const settingsQueryKey = queryKeys.agentControllerSettings(agentControllerId, resourceId, scope);
  const { session } = createAgentControllerClient({ agentControllerId, resourceId, scope, baseUrl, enabled });

  return useMutation({
    mutationFn: async (): Promise<AgentControllerSessionSettings> => {
      const activeSession = requireAgentControllerSession(session);
      await activeSession.setState({}, { unset: ['thinkingLevel'] });
      const persistedState = await activeSession.state();
      const persistedSettings = persistedState.settings;
      if (!persistedSettings || persistedSettings.thinkingLevel !== undefined) {
        throw new Error('The server did not clear the thinking level');
      }
      return persistedSettings;
    },
    onSuccess: persistedSettings => {
      queryClient.setQueryData(settingsQueryKey, persistedSettings);
    },
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: settingsQueryKey, exact: true });
    },
  });
}
