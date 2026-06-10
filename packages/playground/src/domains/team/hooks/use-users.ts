import { useQuery } from '@tanstack/react-query';
import { fetchWithRefresh } from '@/domains/auth/hooks/fetch-with-refresh';
import { useStudioConfig } from '@/domains/configuration/context/studio-config-state';

export interface User {
  id: string;
  email?: string;
  name?: string;
  avatarUrl?: string;
  lastActiveAt?: string;
  createdAt?: string;
}

export interface UseUsersOptions {
  search?: string;
  limit?: number;
  offset?: number;
}

export interface UseUsersResult {
  users: User[];
  total: number;
}

/**
 * Hook to fetch external users (customers) from the server auth provider.
 *
 * @example
 * ```tsx
 * const { data, isLoading, error } = useUsers({ search: 'acme' });
 * ```
 */
export function useUsers(options: UseUsersOptions = {}) {
  const { baseUrl, apiPrefix } = useStudioConfig();
  const { search, limit = 20, offset = 0 } = options;

  return useQuery<UseUsersResult>({
    queryKey: ['users', { search, limit, offset }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (limit) params.set('limit', limit.toString());
      if (offset) params.set('offset', offset.toString());

      const url = `${baseUrl}${apiPrefix}/auth/users${params.toString() ? `?${params}` : ''}`;
      const response = await fetchWithRefresh(baseUrl, url, {
        headers: {
          'Content-Type': 'application/json',
          'x-mastra-client-type': 'studio',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch users: ${response.statusText}`);
      }

      return response.json();
    },
    staleTime: 60_000, // 1 minute
  });
}
