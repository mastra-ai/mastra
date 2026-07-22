import { useQuery } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import { getRuntimeConfig } from '../../web/ui/runtime-config';
import { fetchAuthState } from '../../web/ui/domains/auth/services/auth';
import type { FactoryAuthState } from '../../web/ui/domains/auth/services/auth';

const AUTH_DISABLED_STATE: FactoryAuthState = { authEnabled: false, authenticated: false };

/**
 * Web auth state, shared across the router guards and sidebar identity UI via
 * one cache key. When the served HTML carries `__MASTRACODE_CONFIG__` saying
 * auth is disabled, the `/auth/me` route isn't mounted at all, so short-circuit
 * to the static disabled state instead of probing it (the probe would only hit
 * the SPA fallback and return ambiguous HTML). Absent flag = old HTML or tests:
 * fall back to fetch-and-degrade.
 */
export function useFactoryAuth() {
  const { baseUrl } = useApiConfig();
  const authDisabled = getRuntimeConfig().authEnabled === false;
  return useQuery({
    queryKey: queryKeys.factoryAuth(),
    queryFn: authDisabled ? () => Promise.resolve(AUTH_DISABLED_STATE) : () => fetchAuthState(baseUrl),
  });
}
