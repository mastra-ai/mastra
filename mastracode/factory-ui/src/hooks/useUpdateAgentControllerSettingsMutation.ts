import type { AgentControllerSessionSettings } from '@mastra/client-js';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '../api/keys';
import type { AgentControllerMutationArgs } from './agentControllerMutationArgs';
import {
  createAgentControllerClient,
  requireAgentControllerSession,
} from '../ui/domains/chat/services/agentControllerClient';

export class SettingsUpdateVerificationError extends Error {
  constructor(error: unknown) {
    const detail = error instanceof Error ? error.message : 'Unknown error';
    super(`Settings update could not be verified: ${detail}`);
    this.name = 'SettingsUpdateVerificationError';
  }
}
type SettingsUpdates = Omit<Partial<AgentControllerSessionSettings>, 'thinkingLevel'> & {
  thinkingLevel?: AgentControllerSessionSettings['thinkingLevel'] | null;
};

function applySettingsUpdates(
  settings: AgentControllerSessionSettings,
  updates: SettingsUpdates,
): AgentControllerSessionSettings {
  return {
    yolo: updates.yolo ?? settings.yolo,
    thinkingLevel: updates.thinkingLevel === null ? undefined : (updates.thinkingLevel ?? settings.thinkingLevel),
    notifications: updates.notifications ?? settings.notifications,
    smartEditing: updates.smartEditing ?? settings.smartEditing,
  };
}

function settingsIncludeUpdates(settings: AgentControllerSessionSettings, updates: SettingsUpdates): boolean {
  if (updates.yolo !== undefined && settings.yolo !== updates.yolo) return false;
  if (updates.thinkingLevel === null && settings.thinkingLevel !== undefined) return false;
  if (
    updates.thinkingLevel !== undefined &&
    updates.thinkingLevel !== null &&
    settings.thinkingLevel !== updates.thinkingLevel
  )
    return false;
  if (updates.notifications !== undefined && settings.notifications !== updates.notifications) return false;
  if (updates.smartEditing !== undefined && settings.smartEditing !== updates.smartEditing) return false;
  return true;
}

export function useUpdateAgentControllerSettingsMutation({
  agentControllerId,
  resourceId,
  scope,
  baseUrl = '',
  enabled = true,
}: AgentControllerMutationArgs) {
  const queryClient = useQueryClient();
  const { session } = createAgentControllerClient({ agentControllerId, resourceId, scope, baseUrl, enabled });
  const settingsQueryKey = queryKeys.agentControllerSettings(agentControllerId, resourceId, scope);

  return useMutation({
    mutationFn: async (updates: SettingsUpdates) => {
      const current = queryClient.getQueryData<AgentControllerSessionSettings>(settingsQueryKey);
      if (!current) throw new Error('Session settings are unavailable');

      const activeSession = requireAgentControllerSession(session);
      await activeSession.setState({ ...updates });

      let persistedState;
      try {
        persistedState = await activeSession.state();
      } catch (error) {
        throw new SettingsUpdateVerificationError(error);
      }

      const persistedSettings = persistedState.settings;
      if (!persistedSettings || !settingsIncludeUpdates(persistedSettings, updates)) {
        throw new Error('The server did not persist the requested settings');
      }

      return persistedSettings;
    },
    onMutate: async updates => {
      await queryClient.cancelQueries({ queryKey: settingsQueryKey, exact: true });
      const previousSettings = queryClient.getQueryData<AgentControllerSessionSettings>(settingsQueryKey);

      if (previousSettings) {
        queryClient.setQueryData<AgentControllerSessionSettings>(
          settingsQueryKey,
          applySettingsUpdates(previousSettings, updates),
        );
      }

      return { previousSettings };
    },
    onError: async (error, _updates, context) => {
      if (error instanceof SettingsUpdateVerificationError) {
        await queryClient.invalidateQueries({ queryKey: settingsQueryKey, exact: true });
        return;
      }
      if (context?.previousSettings !== undefined) {
        queryClient.setQueryData(settingsQueryKey, context.previousSettings);
      }
    },
    onSuccess: persistedSettings => {
      queryClient.setQueryData(settingsQueryKey, persistedSettings);
    },
  });
}
