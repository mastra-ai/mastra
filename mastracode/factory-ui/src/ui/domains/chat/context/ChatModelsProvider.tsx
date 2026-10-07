import type { ThinkingLevelSetting } from '@mastra/code-sdk/thinking';
import type { ReactNode } from 'react';
import { useState } from 'react';

import { useDefaultModelQuery } from '../../../../hooks/use-default-model';
import { useAgentControllerSettings } from '../../../../hooks/useAgentControllerSettings';
import { useFactoryProjectQuery } from '../../../../hooks/useFactoryDefaultModel';
import { useSwitchAgentControllerModelMutation } from '../../../../hooks/useAgentControllerStateMutations';
import { useUpdateAgentControllerSettingsMutation } from '../../../../hooks/useUpdateAgentControllerSettingsMutation';
import { useEffectiveThinkingLevel } from '../hooks/useEffectiveThinkingLevel';
import { AGENT_CONTROLLER_ID } from '../services/constants';
import { ChatModelsContext } from './ChatModelsContext';
import type { ChatModelsApi } from './ChatModelsContext';
import { useChatConnection } from './useChatConnection';
import { useChatSessionContext } from './useChatSessionContext';

interface ChatModelsProviderProps {
  children: ReactNode;
}

export function ChatModelsProvider({ children }: ChatModelsProviderProps) {
  const { draftSessionId } = useChatSessionContext();
  if (draftSessionId) {
    return <DraftChatModelsProvider>{children}</DraftChatModelsProvider>;
  }
  return <LiveChatModelsProvider>{children}</LiveChatModelsProvider>;
}

function DraftChatModelsProvider({ children }: ChatModelsProviderProps) {
  const { factorySessionState } = useChatSessionContext();
  const factoryProjectQuery = useFactoryProjectQuery(factorySessionState?.factoryProjectId);
  const defaultModelQuery = useDefaultModelQuery();
  const [draftModelId, setDraftModelId] = useState<string>();
  const [draftThinkingLevel, setDraftThinkingLevel] = useState<ThinkingLevelSetting>();
  const defaultModelId = defaultModelQuery.data?.modelId ?? undefined;
  const activeModelId = draftModelId ?? defaultModelId ?? factoryProjectQuery.data?.defaultModelId ?? undefined;
  const effectiveThinkingLevel = useEffectiveThinkingLevel(activeModelId, draftThinkingLevel);
  const value: ChatModelsApi = {
    activeModelId,
    defaultModelId,
    effectiveThinkingLevel,
    thinkingLevelOverride: draftThinkingLevel,
    isLoading: factoryProjectQuery.isPending || defaultModelQuery.isPending,
    error: defaultModelQuery.error ?? factoryProjectQuery.error ?? undefined,
    setModel: async modelId => {
      setDraftModelId(modelId);
    },
    setThinkingLevel: async level => {
      setDraftThinkingLevel(level);
    },
  };

  return <ChatModelsContext.Provider value={value}>{children}</ChatModelsContext.Provider>;
}

function LiveChatModelsProvider({ children }: ChatModelsProviderProps) {
  const { resourceId, projectPath, baseUrl, sessionEnabled } = useChatSessionContext();
  const { state } = useChatConnection();
  const sessionArgs = {
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceId,
    scope: projectPath,
    baseUrl,
    enabled: sessionEnabled,
  };
  const defaultModelQuery = useDefaultModelQuery();
  const settingsQuery = useAgentControllerSettings(sessionArgs);
  const { mutateAsync: updateSettings } = useUpdateAgentControllerSettingsMutation(sessionArgs);
  const { mutateAsync: switchModel } = useSwitchAgentControllerModelMutation(sessionArgs);
  const activeModelId = state?.modelId;
  const thinkingLevelOverride = settingsQuery.data?.thinkingLevel;
  const resolvedThinkingLevel = useEffectiveThinkingLevel(activeModelId, thinkingLevelOverride);
  const sessionSettingsLoaded = settingsQuery.data !== undefined;
  const value: ChatModelsApi = {
    activeModelId,
    defaultModelId: defaultModelQuery.data?.modelId ?? undefined,
    effectiveThinkingLevel: sessionSettingsLoaded ? resolvedThinkingLevel : undefined,
    thinkingLevelOverride,
    isLoading: false,
    error: undefined,
    setModel: async modelId => {
      await switchModel({ modelId });
    },
    setThinkingLevel: async level => {
      await updateSettings({ thinkingLevel: level });
    },
  };

  return <ChatModelsContext.Provider value={value}>{children}</ChatModelsContext.Provider>;
}
