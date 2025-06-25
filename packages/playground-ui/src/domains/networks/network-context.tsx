import { createContext, useState, ReactNode } from 'react';
import { ModelSettings } from '../../types';

type NetworkContextType = {
  modelSettings: ModelSettings;
  setModelSettings: React.Dispatch<React.SetStateAction<ModelSettings>>;
  resetModelSettings: () => void;
  chatWithLoop: boolean;
  setChatWithLoop: React.Dispatch<React.SetStateAction<boolean>>;
  maxIterations: number | undefined;
  setMaxIterations: React.Dispatch<React.SetStateAction<number | undefined>>;
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
  const [chatWithLoop, setChatWithLoop] = useState<boolean>(false);
  const [maxIterations, setMaxIterations] = useState<number | undefined>(undefined);

  const resetModelSettings = () => {
    setModelSettings(defaultModelSettings);
    setChatWithLoop(false);
    setMaxIterations(undefined);
  };

  return (
    <NetworkContext.Provider
      value={{
        modelSettings,
        setModelSettings,
        resetModelSettings,
        chatWithLoop,
        setChatWithLoop,
        maxIterations,
        setMaxIterations,
      }}
    >
      {children}
    </NetworkContext.Provider>
  );
}
