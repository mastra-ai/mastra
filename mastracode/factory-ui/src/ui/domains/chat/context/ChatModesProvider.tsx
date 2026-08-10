import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';

import { useAgentControllerModes } from '../../../../hooks/useAgentControllerModes';
import { useSwitchAgentControllerModeMutation } from '../../../../hooks/useAgentControllerStateMutations';
import { AGENT_CONTROLLER_ID } from '../services/constants';
import { ChatModesContext } from './ChatModesContext';
import type { ChatModesApi } from './ChatModesContext';
import { useChatConnection } from './useChatConnection';
import { useChatSessionContext } from './useChatSessionContext';

interface ChatModesProviderProps {
  children: ReactNode;
}
const EMPTY_MODES: ChatModesApi['modes'] = [];

export function ChatModesProvider({ children }: ChatModesProviderProps) {
  const { draftSessionId } = useChatSessionContext();
  return draftSessionId ? (
    <DraftChatModesProvider>{children}</DraftChatModesProvider>
  ) : (
    <LiveChatModesProvider>{children}</LiveChatModesProvider>
  );
}

function DraftChatModesProvider({ children }: ChatModesProviderProps) {
  const { resourceId, projectPath, baseUrl } = useChatSessionContext();
  const modesQuery = useAgentControllerModes({
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceId,
    scope: projectPath,
    baseUrl,
    enabled: true,
  });
  const modes = modesQuery.data ?? EMPTY_MODES;
  const [draftModeId, setDraftModeId] = useState<string>();
  const activeModeId = draftModeId ?? modes[0]?.id;
  const value: ChatModesApi = {
    modes,
    activeModeId,
    activeMode: modes.find(mode => mode.id === activeModeId),
    isLoading: modesQuery.isPending,
    error: modesQuery.error ?? undefined,
    setMode: modeId => {
      setDraftModeId(modeId);
      return Promise.resolve();
    },
  };

  return <ChatModesContext.Provider value={value}>{children}</ChatModesContext.Provider>;
}

function LiveChatModesProvider({ children }: ChatModesProviderProps) {
  const { resourceId, projectPath, baseUrl, sessionEnabled } = useChatSessionContext();
  const { state } = useChatConnection();
  const modesQuery = useAgentControllerModes({
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceId,
    scope: projectPath,
    baseUrl,
    enabled: sessionEnabled,
  });
  const { mutateAsync: switchMode } = useSwitchAgentControllerModeMutation({
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceId,
    scope: projectPath,
    baseUrl,
    enabled: sessionEnabled,
  });
  const modes = modesQuery.data ?? EMPTY_MODES;
  const [activeModeId, setActiveModeId] = useState(state?.modeId);

  useEffect(() => {
    setActiveModeId(state?.modeId);
  }, [state?.modeId]);

  const value: ChatModesApi = {
    modes,
    activeModeId,
    activeMode: modes.find(mode => mode.id === activeModeId),
    isLoading: modesQuery.isPending,
    error: modesQuery.error ?? undefined,
    setMode: async modeId => {
      const previousModeId = activeModeId;
      setActiveModeId(modeId);
      try {
        await switchMode(modeId);
      } catch (error) {
        setActiveModeId(currentModeId => (currentModeId === modeId ? previousModeId : currentModeId));
        throw error;
      }
    },
  };

  return <ChatModesContext.Provider value={value}>{children}</ChatModesContext.Provider>;
}
