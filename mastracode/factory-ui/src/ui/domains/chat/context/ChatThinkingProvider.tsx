import { useMemo } from 'react';
import type { ReactNode } from 'react';

import { useDefaultModelQuery } from '@mastra/react/hooks/factory';
import { useAgentControllerSettings } from '../../../../hooks/useAgentControllerSettings';
import { useUpdateAgentControllerSettingsMutation } from '../../../../hooks/useUpdateAgentControllerSettingsMutation';
import { useEffectiveThinkingLevel } from '../hooks/useEffectiveThinkingLevel';
import { AGENT_CONTROLLER_ID } from '../services/constants';
import { ChatThinkingContext } from '@mastra/playground-ui/domains/factory/session/thread/chat/context/ChatThinkingContext';
import type {
  ChatSessionThinkingLevel,
  ChatThinkingApi,
} from '@mastra/playground-ui/domains/factory/session/thread/chat/context/ChatThinkingContext';
import { useChatModels } from '@mastra/playground-ui/domains/factory/session/thread/chat/context/useChatModels';
import { useChatModelScope } from '@mastra/playground-ui/domains/factory/session/thread/chat/context/useChatModelScope';
import { useChatSessionContext } from '@mastra/playground-ui/domains/factory/session/thread/chat/context/useChatSessionContext';

/** One provider for a draft and its thread, so a Start keeps the thinking control mounted. */
export function ChatThinkingProvider({ children }: { children: ReactNode }) {
  const { draftSessionId } = useChatSessionContext();
  const sessionLevel = useSessionThinkingLevel();
  const draft = useDraftThinking();
  const live = useLiveThinking();
  return (
    <ChatThinkingContext.Provider value={{ ...(draftSessionId ? draft : live), sessionLevel }}>
      {children}
    </ChatThinkingContext.Provider>
  );
}

function useSessionThinkingLevel(): ChatSessionThinkingLevel {
  const { sessionId, baseUrl, sessionEnabled } = useChatSessionContext();
  const settingsQuery = useAgentControllerSettings({
    agentControllerId: AGENT_CONTROLLER_ID,
    sessionId,
    baseUrl,
    enabled: sessionEnabled,
  });
  const { data, refetch } = settingsQuery;
  return useMemo(
    () => ({
      loaded: data !== undefined,
      level: data?.thinkingLevel,
      load: async () => {
        if (data) return data.thinkingLevel;
        const result = await refetch();
        if (!result.data) throw new Error('Session settings are unavailable');
        return result.data.thinkingLevel;
      },
    }),
    [data, refetch],
  );
}

function useDraftThinking(): Omit<ChatThinkingApi, 'sessionLevel'> {
  const { catalogTarget, modelScope } = useChatModelScope();
  const { activeModelId, selectedThinkingLevel, select } = useChatModels();
  const defaultModelQuery = useDefaultModelQuery();
  const { level, thinkingDefault, loadError } = useEffectiveThinkingLevel({
    modelId: activeModelId,
    modelScope,
    override: selectedThinkingLevel,
    catalogTarget,
    personalDefault: defaultModelQuery.data?.thinkingLevel,
    personalDefaultError: defaultModelQuery.error,
  });
  return {
    level,
    thinkingDefault,
    loadError,
    override: selectedThinkingLevel,
    setLevel: async next => {
      if (activeModelId) await select?.({ kind: 'model', modelId: activeModelId, thinkingLevel: next });
    },
    resetLevel: async () => {
      if (activeModelId) await select?.({ kind: 'model', modelId: activeModelId });
    },
  };
}

function useLiveThinking(): Omit<ChatThinkingApi, 'sessionLevel'> {
  const { sessionId, baseUrl, sessionEnabled } = useChatSessionContext();
  const { catalogTarget, modelScope, sessionModelsQuery } = useChatModelScope();
  const { activeModelId, selectedPack, selectedThinkingLevel, select } = useChatModels();
  const sessionArgs = {
    agentControllerId: AGENT_CONTROLLER_ID,
    sessionId,
    baseUrl,
    enabled: sessionEnabled,
  };
  const settingsQuery = useAgentControllerSettings(sessionArgs);
  const { mutateAsync: updateSettings } = useUpdateAgentControllerSettingsMutation(sessionArgs);
  const override = selectedPack ? selectedThinkingLevel : settingsQuery.data?.thinkingLevel;
  const effective = useEffectiveThinkingLevel({
    modelId: activeModelId,
    modelScope,
    override,
    catalogTarget,
    personalDefault: sessionModelsQuery.isSuccess ? (sessionModelsQuery.data.personalThinkingLevel ?? null) : undefined,
    personalDefaultError: sessionModelsQuery.error,
  });
  const settingsLoaded = settingsQuery.data !== undefined;
  return {
    level: settingsLoaded ? effective.level : undefined,
    thinkingDefault: effective.thinkingDefault,
    loadError: settingsLoaded ? effective.loadError : (settingsQuery.error ?? undefined),
    override,
    setLevel: async next => {
      if (activeModelId) await select?.({ kind: 'model', modelId: activeModelId, thinkingLevel: next });
    },
    resetLevel: async () => {
      if (selectedPack && activeModelId) await select?.({ kind: 'model', modelId: activeModelId });
      await updateSettings({ thinkingLevel: null });
    },
  };
}
