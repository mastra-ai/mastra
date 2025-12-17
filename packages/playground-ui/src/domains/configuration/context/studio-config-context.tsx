import { createContext, useContext, useLayoutEffect, useState } from 'react';
import { StudioConfig } from '../types';
import { useMastraInstanceStatus } from '../hooks/use-mastra-instance-status';

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
  endpoint?: string;
}

const LOCAL_STORAGE_KEY = 'mastra-studio-config';

export const StudioConfigProvider = ({ children, endpoint = 'http://localhost:4111' }: StudioConfigProviderProps) => {
  const { data: instanceStatus } = useMastraInstanceStatus(endpoint);
  const [config, setConfig] = useState<StudioConfig & { isLoading: boolean }>({
    baseUrl: '',
    headers: {},
    isLoading: true,
  });

  useLayoutEffect(() => {
    // Don't run the effect during the fetch request
    if (!instanceStatus?.status) return;

    const storedConfig = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (storedConfig) {
      const parsedConfig = JSON.parse(storedConfig);

      if (typeof parsedConfig === 'object' && parsedConfig !== null) {
        return setConfig({ ...parsedConfig, isLoading: false });
      }
    }

    if (instanceStatus.status === 'active') {
      return setConfig(prev => ({ ...prev, baseUrl: endpoint, isLoading: false }));
    }

    return setConfig({ baseUrl: '', headers: {}, isLoading: false });
  }, [instanceStatus, endpoint]);

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
