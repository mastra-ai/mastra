import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import { fetchAuthState } from '../ui/domains/auth/services/auth';

/** Web auth state, shared across the router guards and sidebar identity UI via one cache key. */
export function useFactoryAuth({ monitorSession = false } = {}) {
  const { baseUrl } = useApiConfig();

  const auth = useQuery({
    queryKey: queryKeys.factoryAuth(),
    queryFn: () => fetchAuthState(baseUrl),
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
    if (!monitorSession) return;
    // React Query v5 observes tab visibility, but not focus between windows.
    const checkSession = () => void refetch({ cancelRefetch: false });
    window.addEventListener('focus', checkSession);
    return () => window.removeEventListener('focus', checkSession);
  }, [monitorSession, refetch]);

  return auth;
}
