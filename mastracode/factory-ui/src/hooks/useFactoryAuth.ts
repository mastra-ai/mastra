import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import { getRuntimeConfig } from '../ui/runtime-config';
import { fetchAuthState } from '../ui/domains/auth/services/auth';
import type { FactoryAuthState } from '../ui/domains/auth/services/auth';

const AUTH_DISABLED_STATE: FactoryAuthState = { authEnabled: false, authenticated: false };

/**
 * Web auth state, shared across the router guards and sidebar identity UI via
 * one cache key. When the served HTML carries `__MASTRACODE_CONFIG__` saying
 * auth is disabled, the `/auth/me` route isn't mounted at all, so short-circuit
 * to the static disabled state instead of probing it (the probe would only hit
 * the SPA fallback and return ambiguous HTML). Absent flag = old HTML or tests:
 * fall back to fetch-and-degrade.
 */
export function useFactoryAuth({ monitorSession = false } = {}) {
  const { baseUrl } = useApiConfig();
  const authDisabled = getRuntimeConfig().authEnabled === false;

  const auth = useQuery({
    queryKey: queryKeys.factoryAuth(),
    queryFn: () => (authDisabled ? AUTH_DISABLED_STATE : fetchAuthState(baseUrl)),
    // Only route boundaries monitor the session; identity consumers share the cache.
    refetchOnMount: monitorSession ? 'always' : true,
    refetchOnWindowFocus: monitorSession ? 'always' : false,
    refetchOnReconnect: monitorSession ? 'always' : true,
    refetchInterval: query => {
      if (query.state.status === 'error') return 2_000;
      return monitorSession && query.state.data?.authEnabled ? 60_000 : false;
    },
  });

  const { refetch } = auth;
  useEffect(() => {
    if (!monitorSession || authDisabled) return;
    // React Query v5 observes tab visibility, but not focus between windows.
    const checkSession = () => void refetch({ cancelRefetch: false });
    window.addEventListener('focus', checkSession);
    return () => window.removeEventListener('focus', checkSession);
  }, [monitorSession, authDisabled, refetch]);

  return auth;
}
