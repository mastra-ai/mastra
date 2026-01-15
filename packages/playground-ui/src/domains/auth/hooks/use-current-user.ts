import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

import type { CurrentUser } from '../types';

/**
 * Hook to fetch the current authenticated user.
 *
 * Returns the current user if authenticated, null otherwise.
 * Includes roles and permissions if RBAC is available.
 *
 * @example
 * ```tsx
 * import { useCurrentUser } from '@mastra/playground-ui';
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

  return useQuery<CurrentUser>({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      const response = await fetch(`${(client as any).options?.baseUrl || ''}/api/auth/me`, {
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
