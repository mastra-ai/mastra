import { createContext, useState, ReactNode } from 'react';
import { ModelSettings } from '../../../../types';

type AgentContextType = {
  modelSettings: ModelSettings;
  setModelSettings: React.Dispatch<React.SetStateAction<ModelSettings>>;
  resetModelSettings: () => void;
};

const defaultModelSettings: ModelSettings = {
  maxRetries: 2,
  maxSteps: 5,
  temperature: 0.5,
  topP: 1,
};

export const AgentContext = createContext<AgentContextType>({} as AgentContextType);

export function AgentProvider({ children }: { children: ReactNode }) {
  const [modelSettings, setModelSettings] = useState<ModelSettings>(defaultModelSettings);

  const resetModelSettings = () => {
    setModelSettings(defaultModelSettings);
  };

  return (
    <AgentContext.Provider
      value={{
        modelSettings,
        setModelSettings,
        resetModelSettings,
      }}
    >
      {children}
    </AgentContext.Provider>
  );
}
