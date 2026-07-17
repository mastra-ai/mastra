import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';

import { useAgentControllerModes } from '../../../../../shared/hooks/useAgentControllerModes';
import { useSwitchAgentControllerModeMutation } from '../../../../../shared/hooks/useAgentControllerStateMutations';
import { AGENT_CONTROLLER_ID } from '../services/constants';
import { ChatModesContext } from './ChatModesContext';
import type { ChatModesApi } from './ChatModesContext';
import { useChatConnection } from './useChatConnection';
import { useChatSessionContext } from './useChatSessionContext';

interface ChatModesProviderProps {
  children: ReactNode;
}

export function ChatModesProvider({ children }: ChatModesProviderProps) {
  const { resourceId, projectPath, baseUrl, sessionEnabled } = useChatSessionContext();
  const { state } = useChatConnection();
  const modesQuery = useAgentControllerModes({
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceId,
    projectPath,
    baseUrl,
    enabled: sessionEnabled,
  });
  const switchModeMutation = useSwitchAgentControllerModeMutation({
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceId,
    projectPath,
    baseUrl,
    enabled: sessionEnabled,
  });
  const modes = modesQuery.data ?? [];
  const [activeModeId, setActiveModeId] = useState(state?.modeId);

  useEffect(() => {
    setActiveModeId(state?.modeId);
  }, [state?.modeId]);

  const value: ChatModesApi = {
    modes,
    activeModeId,
    activeMode: modes.find(mode => mode.id === activeModeId),
    setMode: async modeId => {
      await switchModeMutation.mutateAsync(modeId);
      setActiveModeId(modeId);
    },
  };

  return <ChatModesContext.Provider value={value}>{children}</ChatModesContext.Provider>;
}
