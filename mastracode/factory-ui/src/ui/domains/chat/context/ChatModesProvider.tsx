import type { ReactNode } from 'react';
import { useState } from 'react';

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
  const { resourceId, projectPath, baseUrl, sessionEnabled, resourceReady } = useChatSessionContext();
  const { state } = useChatConnection();
  const modesQuery = useAgentControllerModes({
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceId,
    scope: projectPath,
    baseUrl,
    enabled: resourceReady,
  });
  const switchModeMutation = useSwitchAgentControllerModeMutation({
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceId,
    scope: projectPath,
    baseUrl,
    // Mode switch is a mutation touching the sandbox — keep on sandboxReady.
    enabled: sessionEnabled,
  });
  const modes = modesQuery.data ?? EMPTY_MODES;
  // the mutation stays pending until the connection state is refetched, so this never snaps back
  const activeModeId = switchModeMutation.isPending ? switchModeMutation.variables : state?.modeId;
  const value: ChatModesApi = {
    modes,
    activeModeId,
    activeMode: modes.find(mode => mode.id === activeModeId),
    isLoading: modesQuery.isPending,
    error: modesQuery.error ?? undefined,
    setMode: modeId => switchModeMutation.mutateAsync(modeId),
  };

  return <ChatModesContext.Provider value={value}>{children}</ChatModesContext.Provider>;
}
