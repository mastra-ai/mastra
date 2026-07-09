import type { ReactNode } from 'react';

import { useAgentControllerModes } from '../hooks/useAgentControllerModes';
import { useSwitchAgentControllerModeMutation } from '../hooks/useAgentControllerStateMutations';
import { AGENT_CONTROLLER_ID } from '../services/constants';
import { ChatModesContext } from './ChatModesContext';
import type { ChatModesApi } from './ChatModesContext';
import { useChatConnection } from './useChatConnection';
import { useChatSessionContext } from './useChatSessionContext';

interface ChatModesProviderProps {
  children: ReactNode;
}

export function ChatModesProvider({ children }: ChatModesProviderProps) {
  const { resourceId, baseUrl, sessionEnabled } = useChatSessionContext();
  const { state } = useChatConnection();
  const modesQuery = useAgentControllerModes({
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceId,
    baseUrl,
    enabled: sessionEnabled,
  });
  const switchModeMutation = useSwitchAgentControllerModeMutation({
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceId,
    baseUrl,
    enabled: sessionEnabled,
  });
  const modes = modesQuery.data ?? [];
  const activeModeId = state?.modeId;
  const value: ChatModesApi = {
    modes,
    activeModeId,
    activeMode: modes.find(mode => mode.id === activeModeId),
    setMode: modeId => switchModeMutation.mutateAsync(modeId),
  };

  return <ChatModesContext.Provider value={value}>{children}</ChatModesContext.Provider>;
}
