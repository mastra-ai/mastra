import type { UseQueryResult } from '@tanstack/react-query';
import type { MastraClient } from '@mastra/client-js';
import { useQuery } from '@tanstack/react-query';
import { useMastraClient } from '../../mastra-client-context';
import type { MastraQueryOptions } from '../shared/query-options';

import { getClientQueryKey } from './get-client-query-key';
import type { AuthCapabilities } from './types';

/**
 * Makes a request to the auth capabilities endpoint.
 * Exported for testing purposes.
 *
 * @internal
 */
export async function makeAuthCapabilitiesRequest(client: MastraClient): Promise<AuthCapabilities> {
  const { baseUrl = '', headers: clientHeaders = {}, apiPrefix } = client.options;
  const raw = (apiPrefix || '/api').trim();
  const prefix = (raw.startsWith('/') ? raw : `/${raw}`).replace(/\/$/, '');

  const response = await fetch(`${baseUrl}${prefix}/auth/capabilities`, {
    credentials: 'include',
    headers: {
      ...clientHeaders,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch auth capabilities: ${response.status}`);
  }

  return response.json();
}

/**
 * Hook to fetch authentication capabilities.
 *
 * Returns server-authoritative capability detection including:
 * - Whether auth is enabled
 * - Login configuration (SSO, credentials, or both)
 * - Current user (if authenticated)
 * - Available capabilities (user awareness, session, SSO, RBAC, ACL, audit)
 * - User access (roles and permissions)
 *
 * @example
 * ```tsx
 * import { useAuthCapabilities } from '@mastra/react/hooks';
 *
 * function AuthStatus() {
 *   const { data: capabilities, isLoading } = useAuthCapabilities();
 *
 *   if (isLoading) return <div>Loading...</div>;
 *   if (!capabilities?.enabled) return <div>Auth not enabled</div>;
 *
 *   if (isAuthenticated(capabilities)) {
 *     return <div>Welcome, {capabilities.user.name}</div>;
 *   }
 *
 *   return <LoginButton config={capabilities.login} />;
 * }
 * ```
 */
export function useAuthCapabilities<TData = AuthCapabilities>({
  queryOptions,
}: { queryOptions?: MastraQueryOptions<AuthCapabilities, TData> } = {}): UseQueryResult<TData, Error> {
  const client = useMastraClient();

  return useQuery<AuthCapabilities, Error, TData>({
    queryKey: ['auth', 'capabilities', getClientQueryKey(client)],
    queryFn: () => makeAuthCapabilitiesRequest(client),
    staleTime: 60 * 1000, // Cache for 1 minute
    retry: false, // Don't retry auth requests
    ...queryOptions,
  });
}
