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
  apiPrefix: undefined,
  isLoading: false,
  setConfig: () => {},
});

export const useStudioConfig = () => {
  return useContext(StudioConfigContext);
};

export interface StudioConfigProviderProps {
  children: React.ReactNode;
  endpoint?: string;
  defaultApiPrefix?: string;
  defaultHeaders?: Record<string, string>;
}

const LOCAL_STORAGE_KEY = 'mastra-studio-config';

export const StudioConfigProvider = ({
  children,
  endpoint = 'http://localhost:4111',
  defaultApiPrefix = '/api',
  defaultHeaders = {},
}: StudioConfigProviderProps) => {
  const { data: instanceStatus, isLoading: isStatusLoading, error } = useMastraInstanceStatus(endpoint);
  const [config, setConfig] = useState<StudioConfig & { isLoading: boolean }>({
    baseUrl: '',
    headers: {},
    apiPrefix: undefined,
    isLoading: true,
  });

  useLayoutEffect(() => {
    // Handle error case - stop loading but don't configure
    if (error && !isStatusLoading) {
      return setConfig({ baseUrl: '', headers: defaultHeaders, apiPrefix: undefined, isLoading: false });
    }

    // Don't run the effect during the fetch request
    if (!instanceStatus?.status) return;

    const storedConfig = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (storedConfig) {
      const parsedConfig = JSON.parse(storedConfig);

      if (typeof parsedConfig === 'object' && parsedConfig !== null) {
        // Use stored apiPrefix if set, otherwise fall back to CLI default for back-compat
        // Merge CLI headers with stored headers, CLI headers take precedence
        const normalizedConfig = {
          ...parsedConfig,
          apiPrefix: parsedConfig.apiPrefix ?? defaultApiPrefix,
          headers: { ...parsedConfig.headers, ...defaultHeaders },
        };
        return setConfig({ ...normalizedConfig, isLoading: false });
      }
    }

    if (instanceStatus.status === 'active') {
      return setConfig(prev => ({ ...prev, baseUrl: endpoint, apiPrefix: defaultApiPrefix, headers: defaultHeaders, isLoading: false }));
    }

    return setConfig({ baseUrl: '', headers: defaultHeaders, apiPrefix: undefined, isLoading: false });
  }, [instanceStatus, endpoint, defaultApiPrefix, defaultHeaders, isStatusLoading, error]);

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
