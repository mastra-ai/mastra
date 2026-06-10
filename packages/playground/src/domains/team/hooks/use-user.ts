import { useQuery } from '@tanstack/react-query';
import type { User } from './use-users';
import { fetchWithRefresh } from '@/domains/auth/hooks/fetch-with-refresh';
import { useStudioConfig } from '@/domains/configuration/context/studio-config-state';

export interface UseUserOptions {
  enabled?: boolean;
}

/**
 * Hook to fetch a single external user (customer) by ID.
 *
 * @example
 * ```tsx
 * const { data, isLoading, error } = useUser('user_123');
 * const { data } = useUser('user_123', { enabled: isOpen });
 * ```
 */
export function useUser(userId: string, options: UseUserOptions = {}) {
  const { baseUrl, apiPrefix } = useStudioConfig();
  const { enabled = true } = options;

  return useQuery<User>({
    queryKey: ['users', userId],
    queryFn: async () => {
      const url = `${baseUrl}${apiPrefix}/auth/users/${userId}`;
      const response = await fetchWithRefresh(baseUrl, url, {
        headers: {
          'Content-Type': 'application/json',
          'x-mastra-client-type': 'studio',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch user: ${response.statusText}`);
      }

      return response.json();
    },
    enabled: !!userId && enabled,
    staleTime: 60_000, // 1 minute
  });
}
