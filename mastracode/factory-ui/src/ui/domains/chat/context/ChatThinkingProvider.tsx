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
  const { draftSessionId, sessionId, baseUrl, sessionEnabled } = useChatSessionContext();
  const { catalogTarget, modelScope, sessionModelsQuery } = useChatModelScope();
  const { activeModelId } = useChatModels();
  const defaultModelQuery = useDefaultModelQuery();
  const [draftOverride, setDraftOverride] = useState(initialDraftThinkingLevel);
  const sessionArgs = {
    agentControllerId: AGENT_CONTROLLER_ID,
    sessionId,
    baseUrl,
    enabled: sessionEnabled,
  };
  const settingsQuery = useAgentControllerSettings(sessionArgs);
  const { mutateAsync: updateSettings } = useUpdateAgentControllerSettingsMutation(sessionArgs);
  const drafting = Boolean(draftSessionId);
  const override = drafting ? draftOverride : settingsQuery.data?.thinkingLevel;
  const effective = useEffectiveThinkingLevel({
    modelId: activeModelId,
    modelScope,
    override,
    catalogTarget,
    personalDefault: drafting
      ? defaultModelQuery.data?.thinkingLevel
      : sessionModelsQuery.isSuccess
        ? (sessionModelsQuery.data.personalThinkingLevel ?? null)
        : undefined,
    personalDefaultError: drafting ? defaultModelQuery.error : sessionModelsQuery.error,
  });

  if (drafting) {
    const draft: ChatThinkingApi = {
      level: effective.level,
      thinkingDefault: effective.thinkingDefault,
      loadError: effective.loadError,
      override,
      setLevel: async next => {
        setDraftOverride(next);
      },
      resetLevel: async () => {
        setDraftOverride(undefined);
      },
    };
    return <ChatThinkingContext.Provider value={draft}>{children}</ChatThinkingContext.Provider>;
  }

  const settingsLoaded = settingsQuery.data !== undefined;
  const live: ChatThinkingApi = {
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
  return <ChatThinkingContext.Provider value={live}>{children}</ChatThinkingContext.Provider>;
}
