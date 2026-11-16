import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';

import { createApiClient } from './client';
import type { ApiClient } from './client';

/**
 * The only React-coupled file in `shared`. It is context-only — no DOM, no
 * `window`, no `import.meta` — so React Native can mount the same provider with
 * its own base URL and (optionally) its own fetch.
 *
 * The web entry builds one config with `createApiConfig({ baseUrl: '' })`
 * (same-origin) and hands it to both this provider and the route loaders; RN
 * would build it with `createApiConfig({ baseUrl: 'https://host', fetchImpl })`.
 * Every data hook reads the client from here instead of threading a `baseUrl` prop.
 */

export interface ApiConfig {
  baseUrl: string;
  client: ApiClient;
}

const ApiConfigContext = createContext<ApiConfig | undefined>(undefined);

/** One app's API config, built once at the entry point. */
export function createApiConfig({ baseUrl, fetchImpl }: { baseUrl: string; fetchImpl?: typeof fetch }): ApiConfig {
  return { baseUrl, client: createApiClient({ baseUrl, fetchImpl }) };
}

export interface ApiConfigProviderProps {
  config: ApiConfig;
  children: ReactNode;
}

export function ApiConfigProvider({ config, children }: ApiConfigProviderProps) {
  return <ApiConfigContext.Provider value={config}>{children}</ApiConfigContext.Provider>;
}

export function useApiConfig(): ApiConfig {
  const ctx = useContext(ApiConfigContext);
  if (!ctx) throw new Error('useApiConfig must be used within an ApiConfigProvider');
  return ctx;
}
