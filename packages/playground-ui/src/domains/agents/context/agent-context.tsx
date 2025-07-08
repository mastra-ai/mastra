import { createContext, ReactNode, useContext } from 'react';
import { ModelSettings } from '@/types';

import {
  useAgentModelSettingsState,
  defaultModelSettings,
} from '@/domains/agents/hooks/use-agent-model-settings-state';

type AgentContextType = {
  modelSettings: ModelSettings;
  chatWithGenerate: boolean;
  setModelSettings: (modelSettings: ModelSettings) => void;
  resetModelSettings: () => void;
  setChatWithGenerate: (chatWithGenerate: boolean) => void;
};

export const AgentSettingsContext = createContext<AgentContextType>({} as AgentContextType);

export interface AgentSettingsProviderProps {
  children: ReactNode;
  agentId: string;
}

export function AgentSettingsProvider({ children, agentId }: AgentSettingsProviderProps) {
  const { modelSettings, setModelSettings, chatWithGenerate, setChatWithGenerate, resetAll } =
    useAgentModelSettingsState({
      agentId,
    });

  const onChangeModelSettings = (modelSettings: ModelSettings) => {
    setModelSettings(modelSettings);
  };

  const onChangeChatWithGenerate = (chatWithGenerate: boolean) => {
    setChatWithGenerate(chatWithGenerate);
  };

  const onReset = () => {
    resetAll();
  };

  return (
    <AgentSettingsContext.Provider
      value={{
        modelSettings: modelSettings ?? defaultModelSettings,
        setModelSettings: onChangeModelSettings,
        resetModelSettings: onReset,
        chatWithGenerate: chatWithGenerate ?? false,
        setChatWithGenerate: onChangeChatWithGenerate,
      }}
    >
      {children}
    </AgentSettingsContext.Provider>
  );
}

export const useAgentSettings = () => {
  return useContext(AgentSettingsContext);
};
