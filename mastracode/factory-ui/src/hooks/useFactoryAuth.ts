import { useQuery } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import { fetchAuthState } from '../ui/domains/auth/services/auth';

/** Web auth state, shared across the router guards and sidebar identity UI via one cache key. */
export function useFactoryAuth({ monitorSession = false } = {}) {
  const { baseUrl } = useApiConfig();

  return useQuery({
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
}

/** A refetch puts an errored query with no data back to pending; the error count survives it. */
export function authCheckFailed({ data, errorUpdateCount }: { data: unknown; errorUpdateCount: number }): boolean {
  return data === undefined && errorUpdateCount > 0;
}
