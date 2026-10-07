import { runThinkingLevel } from '@mastra/code-sdk/thinking';
import type { ThinkingLevelSetting } from '@mastra/code-sdk/thinking';
import type { ReactNode } from 'react';
import { useState } from 'react';

import { useDefaultModelQuery } from '../../../../hooks/use-default-model';
import { useThinkingConfigQuery } from '../../../../hooks/use-thinking';
import { useAgentControllerSettings } from '../../../../hooks/useAgentControllerSettings';
import { useFactoryProjectQuery } from '../../../../hooks/useFactoryDefaultModel';
import { useSwitchAgentControllerModelMutation } from '../../../../hooks/useAgentControllerStateMutations';
import { useUpdateAgentControllerSettingsMutation } from '../../../../hooks/useUpdateAgentControllerSettingsMutation';
import { AGENT_CONTROLLER_ID } from '../services/constants';
import { resolveEffectiveThinkingLevel } from '../services/thinkingLevels';
import { ChatModelsContext } from './ChatModelsContext';
import type { ChatModelsApi } from './ChatModelsContext';
import { useChatConnection } from './useChatConnection';
import { useChatModes } from './useChatModes';
import { useChatSessionContext } from './useChatSessionContext';

interface ChatModelsProviderProps {
  children: ReactNode;
}

export function ChatModelsProvider({ children }: ChatModelsProviderProps) {
  const { draftSessionId } = useChatSessionContext();
  return draftSessionId ? (
    <DraftChatModelsProvider>{children}</DraftChatModelsProvider>
  ) : (
    <LiveChatModelsProvider>{children}</LiveChatModelsProvider>
  );
}

function DraftChatModelsProvider({ children }: ChatModelsProviderProps) {
  const { factorySessionState } = useChatSessionContext();
  const { activeModeId } = useChatModes();
  const factoryProjectQuery = useFactoryProjectQuery(factorySessionState?.factoryProjectId);
  const defaultModelQuery = useDefaultModelQuery();
  const thinkingConfigQuery = useThinkingConfigQuery();
  const [draftModelId, setDraftModelId] = useState<string>();
  const [draftThinkingLevel, setDraftThinkingLevel] = useState<ThinkingLevelSetting>();
  const defaultModelId = defaultModelQuery.data?.modelId ?? undefined;
  const activeModelId = draftModelId ?? defaultModelId ?? factoryProjectQuery.data?.defaultModelId ?? undefined;
  const thinkingLevelOverride =
    draftThinkingLevel && activeModelId ? runThinkingLevel(activeModelId, draftThinkingLevel) : undefined;
  const value: ChatModelsApi = {
    activeModelId,
    defaultModelId,
    effectiveThinkingLevel: resolveEffectiveThinkingLevel({
      modelId: activeModelId,
      override: thinkingLevelOverride,
      defaults: thinkingConfigQuery.data,
      modeId: activeModeId,
    }),
    thinkingLevelOverride,
    isLoading: factoryProjectQuery.isPending || defaultModelQuery.isPending,
    error: defaultModelQuery.error ?? factoryProjectQuery.error ?? undefined,
    setModel: modelId => {
      setDraftModelId(modelId);
      return Promise.resolve();
    },
    setThinkingLevel: level => {
      setDraftThinkingLevel(level);
      return Promise.resolve();
    },
  };

  return <ChatModelsContext.Provider value={value}>{children}</ChatModelsContext.Provider>;
}

function LiveChatModelsProvider({ children }: ChatModelsProviderProps) {
  const { resourceId, projectPath, baseUrl, sessionEnabled } = useChatSessionContext();
  const { state } = useChatConnection();
  const { activeModeId } = useChatModes();
  const sessionArgs = {
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceId,
    scope: projectPath,
    baseUrl,
    enabled: sessionEnabled,
  };
  const defaultModelQuery = useDefaultModelQuery();
  const thinkingConfigQuery = useThinkingConfigQuery();
  const settingsQuery = useAgentControllerSettings(sessionArgs);
  const { mutateAsync: updateSettings } = useUpdateAgentControllerSettingsMutation(sessionArgs);
  const { mutateAsync: switchModel } = useSwitchAgentControllerModelMutation(sessionArgs);
  const activeModelId = state?.modelId;
  const thinkingLevelOverride = settingsQuery.data?.thinkingLevel;
  const value: ChatModelsApi = {
    activeModelId,
    defaultModelId: defaultModelQuery.data?.modelId ?? undefined,
    effectiveThinkingLevel: settingsQuery.data
      ? resolveEffectiveThinkingLevel({
          modelId: activeModelId,
          override: thinkingLevelOverride,
          defaults: thinkingConfigQuery.data,
          modeId: activeModeId,
        })
      : undefined,
    thinkingLevelOverride,
    isLoading: false,
    error: undefined,
    setModel: async modelId => {
      await switchModel({
        modelId,
        thinkingLevel: thinkingLevelOverride && runThinkingLevel(modelId, thinkingLevelOverride),
      });
    },
    setThinkingLevel: async level => {
      await updateSettings({ thinkingLevel: level });
    },
  };

  return <ChatModelsContext.Provider value={value}>{children}</ChatModelsContext.Provider>;
}
