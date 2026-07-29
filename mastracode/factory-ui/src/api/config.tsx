import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';

import { createApiClient } from './client';
import type { ApiClient } from './client';

/**
 * The only React-coupled file in `shared`. It is context-only — no DOM, no
 * `window`, no `import.meta` — so React Native can mount the same provider with
 * its own base URL and (optionally) its own fetch.
 *
 * The web entry mounts `<ApiConfigProvider baseUrl="">` (same-origin); RN would
 * mount `<ApiConfigProvider baseUrl="https://host" fetchImpl={rnFetch}>`. Every
 * data hook reads the client from here instead of threading a `baseUrl` prop.
 */

export interface ApiConfig {
  baseUrl: string;
  client: ApiClient;
}

const ApiConfigContext = createContext<ApiConfig | null>(null);

export interface ApiConfigProviderProps {
  baseUrl: string;
  fetchImpl?: typeof fetch;
  children: ReactNode;
}

export function ApiConfigProvider({ baseUrl, fetchImpl, children }: ApiConfigProviderProps) {
  const value = useMemo<ApiConfig>(
    () => ({ baseUrl, client: createApiClient({ baseUrl, fetchImpl }) }),
    [baseUrl, fetchImpl],
  );
  return <ApiConfigContext.Provider value={value}>{children}</ApiConfigContext.Provider>;
}

export function useApiConfig(): ApiConfig {
  const ctx = useContext(ApiConfigContext);
  if (!ctx) throw new Error('useApiConfig must be used within an ApiConfigProvider');
  return ctx;
}
