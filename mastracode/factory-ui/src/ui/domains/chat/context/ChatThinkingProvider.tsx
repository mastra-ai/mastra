import type { ThinkingLevelSetting } from '@mastra/code-sdk/thinking';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { useChatModelScope } from './useChatModelScope';

import { useDefaultModelQuery } from '../../../../hooks/use-default-model';
import { useAgentControllerSettings } from '../../../../hooks/useAgentControllerSettings';
import { useUpdateAgentControllerSettingsMutation } from '../../../../hooks/useUpdateAgentControllerSettingsMutation';
import { useEffectiveThinkingLevel } from '../hooks/useEffectiveThinkingLevel';
import { AGENT_CONTROLLER_ID } from '../services/constants';
import { ChatThinkingContext } from './ChatThinkingContext';
import type { ChatThinkingApi } from './ChatThinkingContext';
import { useChatModels } from './useChatModels';
import { useChatSessionContext } from './useChatSessionContext';

/** One provider for a draft and its thread, so a Start keeps the thinking control mounted. */
export function ChatThinkingProvider({
  children,
  initialDraftThinkingLevel,
}: {
  children: ReactNode;
  initialDraftThinkingLevel?: ThinkingLevelSetting;
}) {
  const { draftSessionId } = useChatSessionContext();
  const draft = useDraftThinking(initialDraftThinkingLevel);
  const live = useLiveThinking();
  return <ChatThinkingContext.Provider value={draftSessionId ? draft : live}>{children}</ChatThinkingContext.Provider>;
}

function useDraftThinking(initialOverride: ThinkingLevelSetting | undefined): ChatThinkingApi {
  const { catalogTarget, modelScope } = useChatModelScope();
  const { activeModelId } = useChatModels();
  const defaultModelQuery = useDefaultModelQuery();
  const [override, setOverride] = useState(initialOverride);
  const { level, thinkingDefault, loadError } = useEffectiveThinkingLevel({
    modelId: activeModelId,
    modelScope,
    override,
    catalogTarget,
    personalDefault: defaultModelQuery.data?.thinkingLevel,
    personalDefaultError: defaultModelQuery.error,
  });
  return {
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
}

function useLiveThinking(): ChatThinkingApi {
  const { sessionId, baseUrl, sessionEnabled } = useChatSessionContext();
  const { catalogTarget, modelScope, sessionModelsQuery } = useChatModelScope();
  const { activeModelId } = useChatModels();
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
      await updateSettings({ thinkingLevel: next });
    },
    resetLevel: async () => {
      await updateSettings({ thinkingLevel: null });
    },
  };
}
