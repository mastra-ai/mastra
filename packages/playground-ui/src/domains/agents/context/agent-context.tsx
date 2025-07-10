import { createContext, ReactNode, useContext } from 'react';
import { AgentSettingsType as AgentSettings } from '@/types';

import { useAgentSettingsState } from '@/domains/agents/hooks/use-agent-settings-state';

type AgentContextType = {
  settings?: AgentSettings;
  setSettings: (settings: AgentSettings) => void;
  resetAll: () => void;
};

export const AgentSettingsContext = createContext<AgentContextType>({} as AgentContextType);

export interface AgentSettingsProviderProps {
  children: ReactNode;
  agentId: string;
}

export function AgentSettingsProvider({ children, agentId }: AgentSettingsProviderProps) {
  const { settings, setSettings, resetAll } = useAgentSettingsState({
    agentId,
  });

  return (
    <AgentSettingsContext.Provider
      value={{
        settings,
        setSettings,
        resetAll,
      }}
    >
      {children}
    </AgentSettingsContext.Provider>
  );
}

export const useAgentSettings = () => {
  return useContext(AgentSettingsContext);
};
