import type { ReactNode } from 'react';

import { useAgentControllerModes } from '../hooks/useAgentControllerModes';
import { useSwitchAgentControllerModeMutation } from '../hooks/useAgentControllerStateMutations';
import { ChatModesContext } from './ChatModesContext';
import type { ChatModesApi } from './ChatModesContext';

interface ChatModesProviderProps {
  children: ReactNode;
  agentControllerId: string;
  resourceId: string;
  baseUrl?: string;
  enabled?: boolean;
  sessionModeId?: string;
  transcriptModeId?: string;
}

export function ChatModesProvider({
  children,
  agentControllerId,
  resourceId,
  baseUrl,
  enabled = true,
  sessionModeId,
  transcriptModeId,
}: ChatModesProviderProps) {
  const modesQuery = useAgentControllerModes({ agentControllerId, resourceId, baseUrl, enabled });
  const switchModeMutation = useSwitchAgentControllerModeMutation({ agentControllerId, resourceId, baseUrl, enabled });
  const modes = modesQuery.data ?? [];
  const activeModeId = sessionModeId ?? transcriptModeId;
  const value: ChatModesApi = {
    modes,
    activeModeId,
    activeMode: modes.find(mode => mode.id === activeModeId),
    setMode: modeId => switchModeMutation.mutateAsync(modeId),
  };

  return <ChatModesContext.Provider value={value}>{children}</ChatModesContext.Provider>;
}
