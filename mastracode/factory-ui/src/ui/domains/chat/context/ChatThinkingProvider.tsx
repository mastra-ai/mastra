import type { ThinkingLevelSetting } from '@mastra/code-sdk/thinking';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { useChatModelScope } from './useChatModelScope';

import type { DefaultModelResponse } from '../../../../api/types';
import { useDefaultModelQuery } from '../../../../hooks/use-default-model';
import { useAgentControllerSettings } from '../../../../hooks/useAgentControllerSettings';
import type { SessionModelCatalog } from '../../../../hooks/useSessionModelCatalog';
import { useUpdateAgentControllerSettingsMutation } from '../../../../hooks/useUpdateAgentControllerSettingsMutation';
import type { FactoryModelScope } from '../../workspaces/services/github';
import { useEffectiveThinkingLevel } from '../hooks/useEffectiveThinkingLevel';
import { AGENT_CONTROLLER_ID } from '../services/constants';
import type { PersonalThinkingDefault } from '../services/thinkingLevels';
import { routedPersonalThinkingLevel } from './chatDefaultModel';
import { ChatThinkingContext } from './ChatThinkingContext';
import type { ChatThinkingApi } from './ChatThinkingContext';
import { useChatModels } from './useChatModels';
import { useChatSessionContext } from './useChatSessionContext';

interface ChatThinkingProviderProps {
  children: ReactNode;
}

export function ChatThinkingProvider({ children }: ChatThinkingProviderProps) {
  const { draftSessionId } = useChatSessionContext();
  return draftSessionId ? (
    <DraftChatThinkingProvider>{children}</DraftChatThinkingProvider>
  ) : (
    <LiveChatThinkingProvider>{children}</LiveChatThinkingProvider>
  );
}

function DraftChatThinkingProvider({ children }: ChatThinkingProviderProps) {
  const { catalogTarget, modelScope } = useChatModelScope();
  const { activeModelId } = useChatModels();
  const defaultModelQuery = useDefaultModelQuery();
  const [override, setOverride] = useState<ThinkingLevelSetting>();
  const { level, thinkingDefault, loadError } = useEffectiveThinkingLevel({
    modelId: activeModelId,
    override,
    catalogTarget,
    personalDefault: routedPersonalThinkingLevel(modelScope, defaultModelQuery.data),
    personalDefaultError: defaultModelQuery.error,
  });
  const value: ChatThinkingApi = {
    level,
    thinkingDefault,
    loadError,
    override,
    setLevel: async next => {
      setOverride(next);
    },
    resetLevel: async () => {
      setOverride(undefined);
    },
  };

  return <ChatThinkingContext.Provider value={value}>{children}</ChatThinkingContext.Provider>;
}

function livePersonalThinkingLevel(
  sessionCatalog: SessionModelCatalog | undefined,
  modelScope: FactoryModelScope | undefined,
  personalDefaults: DefaultModelResponse | undefined,
): PersonalThinkingDefault {
  if (!sessionCatalog) return undefined;
  if ('personalThinkingLevel' in sessionCatalog) return sessionCatalog.personalThinkingLevel ?? null;
  return routedPersonalThinkingLevel(modelScope, personalDefaults);
}

function LiveChatThinkingProvider({ children }: ChatThinkingProviderProps) {
  const { sessionId, baseUrl, sessionEnabled } = useChatSessionContext();
  const { catalogTarget, modelScope, sessionModelsQuery } = useChatModelScope();
  const { activeModelId } = useChatModels();
  const defaultModelQuery = useDefaultModelQuery();
  const sessionArgs = {
    agentControllerId: AGENT_CONTROLLER_ID,
    sessionId,
    baseUrl,
    enabled: sessionEnabled,
  };
  const settingsQuery = useAgentControllerSettings(sessionArgs);
  const { mutateAsync: updateSettings } = useUpdateAgentControllerSettingsMutation(sessionArgs);
  const override = settingsQuery.data?.thinkingLevel;
  const effective = useEffectiveThinkingLevel({
    modelId: activeModelId,
    override,
    catalogTarget,
    personalDefault: livePersonalThinkingLevel(
      sessionModelsQuery.isSuccess ? sessionModelsQuery.data : undefined,
      modelScope,
      defaultModelQuery.data,
    ),
    personalDefaultError: sessionModelsQuery.error ?? defaultModelQuery.error,
  });
  const settingsLoaded = settingsQuery.data !== undefined;
  const settingsLoadError = settingsQuery.error ?? undefined;
  const value: ChatThinkingApi = {
    level: settingsLoaded ? effective.level : undefined,
    thinkingDefault: effective.thinkingDefault,
    loadError: settingsLoaded ? effective.loadError : settingsLoadError,
    override,
    setLevel: async next => {
      await updateSettings({ thinkingLevel: next });
    },
    resetLevel: async () => {
      await updateSettings({ thinkingLevel: null });
    },
  };

  return <ChatThinkingContext.Provider value={value}>{children}</ChatThinkingContext.Provider>;
}
