import type { MastraClient } from '@mastra/client-js';
import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

import type { AuthCapabilities } from '../types';

/**
 * Makes a request to the auth capabilities endpoint.
 * Exported for testing purposes.
 *
 * @internal
 */
export async function makeAuthCapabilitiesRequest(client: MastraClient): Promise<AuthCapabilities> {
  const { baseUrl = '', headers: clientHeaders = {}, apiPrefix } = client.options as any;
  const raw = (apiPrefix || '/api').trim();
  const prefix = (raw.startsWith('/') ? raw : `/${raw}`).replace(/\/$/, '');

  const response = await fetch(`${baseUrl}${prefix}/auth/capabilities`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...clientHeaders,
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
 * import { useAuthCapabilities } from '@/domains/auth/hooks/use-auth-capabilities';
import { isAuthenticated } from '@/domains/auth/types';
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
export function useAuthCapabilities() {
  const client = useMastraClient();

  return useQuery<AuthCapabilities>({
    queryKey: ['auth', 'capabilities'],
    queryFn: () => makeAuthCapabilitiesRequest(client),
    staleTime: 60 * 1000, // Cache for 1 minute
    retry: false, // Don't retry auth requests
  });
}
