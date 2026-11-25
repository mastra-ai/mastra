import { useEffect, useState } from 'react';

import type { MastraInstanceStatus } from '../hooks/use-mastra-instance-status';
import { useMastraInstanceStatus } from '../hooks/use-mastra-instance-status';
import type { StudioConfig } from '../types';
import type { StudioConnection } from './studio-config-state';
import { StudioConfigContext, StudioConnectionContext } from './studio-config-state';

export interface StudioConfigProviderProps {
  children: React.ReactNode;
  endpoint?: string;
  defaultApiPrefix?: string;
}

export const MASTRA_STUDIO_CONFIG_LOCAL_STORAGE_KEY = 'mastra-studio-config';
const AUTH_HEADER_PARAM = 'auth_header';
const AUTH_HEADER_NAME = 'Authorization';

const readUrlAuthHeader = (): Record<string, string> => {
  if (typeof window === 'undefined') return {};

  const authHeader = new URL(window.location.href).searchParams.get(AUTH_HEADER_PARAM);
  return authHeader ? { [AUTH_HEADER_NAME]: authHeader } : {};
};

const removeUrlAuthHeader = () => {
  if (typeof window === 'undefined') return;

  const url = new URL(window.location.href);
  if (!url.searchParams.has(AUTH_HEADER_PARAM)) return;

  url.searchParams.delete(AUTH_HEADER_PARAM);
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
};

const getPersistentConfig = (config: StudioConfig): StudioConfig => {
  const { [AUTH_HEADER_NAME]: _authorization, ...headers } = config.headers;
  return { ...config, headers };
};

const readStoredConfig = (defaultConfig: StudioConfig): StudioConfig | undefined => {
  const storedConfig = localStorage.getItem(MASTRA_STUDIO_CONFIG_LOCAL_STORAGE_KEY);
  if (!storedConfig) return undefined;

  const parsedConfig = JSON.parse(storedConfig);
  if (typeof parsedConfig !== 'object' || parsedConfig === null) return undefined;

  return {
    baseUrl: parsedConfig.baseUrl || defaultConfig.baseUrl,
    headers: { ...(parsedConfig.headers ?? {}), ...defaultConfig.headers },
    // Use stored apiPrefix if set, otherwise fall back to CLI default for back-compat
    apiPrefix: parsedConfig.apiPrefix ?? defaultConfig.apiPrefix,
  };
};

const storeConfig = (config: StudioConfig) =>
  localStorage.setItem(MASTRA_STUDIO_CONFIG_LOCAL_STORAGE_KEY, JSON.stringify(config));

interface ConnectionQuery {
  data: MastraInstanceStatus | undefined;
  isPlaceholderData: boolean;
}

const getConnection = ({ data, isPlaceholderData }: ConnectionQuery): StudioConnection => {
  if (data?.status === 'active') return { status: 'connected' };
  // The last answer is about the connection before the one being checked.
  if (!data || isPlaceholderData) return { status: 'connecting' };
  return data;
};

export const StudioConfigProvider = ({
  children,
  endpoint = 'http://localhost:4111',
  defaultApiPrefix = '/api',
}: StudioConfigProviderProps) => {
  const [urlHeaders] = useState<Record<string, string>>(readUrlAuthHeader);
  const hasUrlHeaders = Object.keys(urlHeaders).length > 0;
  const defaultConfig: StudioConfig = { baseUrl: endpoint, headers: urlHeaders, apiPrefix: defaultApiPrefix };

  const [{ config, revision }, setSaved] = useState(() => ({
    config: readStoredConfig(defaultConfig) ?? defaultConfig,
    revision: 0,
  }));
  const [isEditing, setIsEditing] = useState(false);

  const statusQuery = useMastraInstanceStatus(config, { revision, paused: isEditing });
  const connection = getConnection(statusQuery);
  const isConnected = connection.status === 'connected';

  useEffect(() => {
    removeUrlAuthHeader();
  }, []);

  useEffect(() => {
    if (isConnected && hasUrlHeaders) storeConfig(getPersistentConfig(config));
  }, [isConnected, hasUrlHeaders, config]);

  const connectTo = (nextConfig: StudioConfig) => {
    setSaved({ config: nextConfig, revision: revision + 1 });
    setIsEditing(false);
  };

  const setConfig = (partialNewConfig: Partial<StudioConfig>) => {
    const nextConfig = { ...config, ...partialNewConfig };
    storeConfig(hasUrlHeaders ? getPersistentConfig(nextConfig) : nextConfig);
    connectTo(nextConfig);
  };

  const resetConfig = () => {
    localStorage.removeItem(MASTRA_STUDIO_CONFIG_LOCAL_STORAGE_KEY);
    connectTo(defaultConfig);
  };

  const isDefault = config.baseUrl === endpoint && config.apiPrefix === defaultApiPrefix;

  return (
    <StudioConfigContext.Provider value={{ ...config, isLoading: statusQuery.isPending, setConfig }}>
      <StudioConnectionContext.Provider
        value={{ connection, isEditing, setIsEditing, resetConfig: isDefault ? undefined : resetConfig }}
      >
        {children}
      </StudioConnectionContext.Provider>
    </StudioConfigContext.Provider>
  );
};
