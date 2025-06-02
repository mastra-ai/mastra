import { createContext, useState, ReactNode } from 'react';
import { ModelSettings } from '../../types';

type NetworkContextType = {
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

export const NetworkContext = createContext<NetworkContextType>({} as NetworkContextType);

export function NetworkProvider({ children }: { children: ReactNode }) {
  const [modelSettings, setModelSettings] = useState<ModelSettings>(defaultModelSettings);

  const resetModelSettings = () => {
    setModelSettings(defaultModelSettings);
  };

  return (
    <NetworkContext.Provider
      value={{
        modelSettings,
        setModelSettings,
        resetModelSettings,
      }}
    >
      {children}
    </NetworkContext.Provider>
  );
}
