import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

import type { CurrentUser } from '../types';
import { fetchWithRefresh } from './fetch-with-refresh';

/**
 * Hook to fetch the current authenticated user.
 *
 * Returns the current user if authenticated, null otherwise.
 * Includes roles and permissions if RBAC is available.
 *
 * Uses fetchWithRefresh to automatically refresh the session on 401 errors,
 * preventing users from being logged out when the access token expires.
 *
 * @example
 * ```tsx
 * import { useCurrentUser } from '@/domains/auth/hooks/use-current-user';
 *
 * function UserMenu() {
 *   const { data: user, isLoading } = useCurrentUser();
 *
 *   if (isLoading) return <Skeleton />;
 *   if (!user) return <LoginButton />;
 *
 *   return (
 *     <Menu>
 *       <Avatar src={user.avatarUrl} />
 *       <span>{user.name || user.email}</span>
 *     </Menu>
 *   );
 * }
 * ```
 */
export function useCurrentUser() {
  const client = useMastraClient();
  const baseUrl = (client as any).options?.baseUrl || '';

  return useQuery<CurrentUser>({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      const response = await fetchWithRefresh(baseUrl, `${baseUrl}/api/auth/me`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch current user: ${response.status}`);
      }

      return response.json();
    },
    staleTime: 60 * 1000, // Cache for 1 minute
    retry: false,
  });
}
