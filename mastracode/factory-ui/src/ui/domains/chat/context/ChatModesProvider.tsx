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

export function ChatModesProvider({ children }: ChatModesProviderProps) {
  const { resourceId, projectPath, baseUrl, sessionEnabled, draftSessionId } = useChatSessionContext();
  const { state } = useChatConnection();
  // The modes catalog is controller-global, so a draft can offer it before the
  // session exists; the pick lives here and travels with the prompt.
  const modesQuery = useAgentControllerModes({
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceId,
    scope: projectPath,
    baseUrl,
    enabled: sessionEnabled || Boolean(draftSessionId),
  });
  const switchModeMutation = useSwitchAgentControllerModeMutation({
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceId,
    scope: projectPath,
    baseUrl,
    enabled: sessionEnabled,
  });
  const modes = modesQuery.data ?? [];
  const [activeModeId, setActiveModeId] = useState(state?.modeId);
  const [draftModeId, setDraftModeId] = useState<string>();

  useEffect(() => {
    setActiveModeId(state?.modeId);
  }, [state?.modeId]);

  const selectedDraftModeId = draftModeId ?? modes[0]?.id;
  const value: ChatModesApi = draftSessionId
    ? {
        modes,
        activeModeId: selectedDraftModeId,
        activeMode: modes.find(mode => mode.id === selectedDraftModeId),
        setMode: modeId => Promise.resolve(setDraftModeId(modeId)),
      }
    : {
        modes,
        activeModeId,
        activeMode: modes.find(mode => mode.id === activeModeId),
        setMode: async modeId => {
          const previousModeId = activeModeId;
          setActiveModeId(modeId);
          try {
            await switchModeMutation.mutateAsync(modeId);
          } catch (error) {
            setActiveModeId(currentModeId => (currentModeId === modeId ? previousModeId : currentModeId));
            throw error;
          }
        },
      };

  return <ChatModesContext.Provider value={value}>{children}</ChatModesContext.Provider>;
}
