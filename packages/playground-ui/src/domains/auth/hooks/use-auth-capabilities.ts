import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

import type { AuthCapabilities } from '../types';

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
 * import { useAuthCapabilities, isAuthenticated } from '@mastra/playground-ui';
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
    queryFn: async () => {
      // Use the client's internal request method to call the auth endpoint
      // This ensures proper base URL handling and headers
      const response = await fetch(`${(client as any).options?.baseUrl || ''}/api/auth/capabilities`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch auth capabilities: ${response.status}`);
      }

      return response.json();
    },
    staleTime: 60 * 1000, // Cache for 1 minute
    retry: false, // Don't retry auth requests
  });
}
