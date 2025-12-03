import { createContext, useContext, useLayoutEffect, useState } from 'react';
import { StudioConfig } from '../types';

export type StudioConfigContextType = StudioConfig & {
  isLoading: boolean;
  setConfig: (partialNewConfig: Partial<StudioConfig>) => void;
};

export const StudioConfigContext = createContext<StudioConfigContextType>({
  baseUrl: '',
  headers: {},
  isLoading: false,
  setConfig: () => {},
});

export const useStudioConfig = () => {
  return useContext(StudioConfigContext);
};

export interface StudioConfigProviderProps {
  children: React.ReactNode;
}

const LOCAL_STORAGE_KEY = 'mastra-studio-config';

export const StudioConfigProvider = ({ children }: StudioConfigProviderProps) => {
  const [config, setConfig] = useState<StudioConfig & { isLoading: boolean }>({
    baseUrl: '',
    headers: {},
    isLoading: true,
  });

  useLayoutEffect(() => {
    const storedConfig = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (storedConfig) {
      const parsedConfig = JSON.parse(storedConfig);

      if (typeof parsedConfig === 'object' && parsedConfig !== null) {
        return setConfig({ ...parsedConfig, isLoading: false });
      }
    }

    return setConfig({ baseUrl: '', headers: {}, isLoading: false });
  }, []);

  const doSetConfig = (partialNewConfig: Partial<StudioConfig>) => {
    setConfig(prev => {
      const nextConfig = { ...prev, ...partialNewConfig };
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(nextConfig));
      return nextConfig;
    });
  };

  return (
    <StudioConfigContext.Provider value={{ ...config, setConfig: doSetConfig }}>
      {children}
    </StudioConfigContext.Provider>
  );
};
