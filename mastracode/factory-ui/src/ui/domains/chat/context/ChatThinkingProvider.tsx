import type { ThinkingLevelSetting } from '@mastra/code-sdk/thinking';
import type { ReactNode } from 'react';
import { useState } from 'react';

import { useAgentControllerSettings } from '../../../../hooks/useAgentControllerSettings';
import { useUpdateAgentControllerSettingsMutation } from '../../../../hooks/useUpdateAgentControllerSettingsMutation';
import { useEffectiveThinkingLevel } from '../hooks/useEffectiveThinkingLevel';
import { AGENT_CONTROLLER_ID } from '../services/constants';
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
  const { activeModelId, defaultThinkingLevel } = useChatModels();
  const [override, setOverride] = useState<ThinkingLevelSetting>();
  const level = useEffectiveThinkingLevel(activeModelId, override, defaultThinkingLevel);
  const value: ChatThinkingApi = {
    level,
    loadError: undefined,
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

function LiveChatThinkingProvider({ children }: ChatThinkingProviderProps) {
  const { resourceId, projectPath, baseUrl, sessionEnabled } = useChatSessionContext();
  const { activeModelId, defaultThinkingLevel } = useChatModels();
  const sessionArgs = {
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceId,
    scope: projectPath,
    baseUrl,
    enabled: sessionEnabled,
  };
  const settingsQuery = useAgentControllerSettings(sessionArgs);
  const { mutateAsync: updateSettings } = useUpdateAgentControllerSettingsMutation(sessionArgs);
  const override = settingsQuery.data?.thinkingLevel;
  const effectiveLevel = useEffectiveThinkingLevel(activeModelId, override, defaultThinkingLevel);
  const settingsLoaded = settingsQuery.data !== undefined;
  const value: ChatThinkingApi = {
    level: settingsLoaded ? effectiveLevel : undefined,
    loadError: settingsLoaded ? undefined : (settingsQuery.error ?? undefined),
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
