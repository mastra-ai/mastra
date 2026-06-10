import { useQuery } from '@tanstack/react-query';
import { fetchWithRefresh } from '@/domains/auth/hooks/fetch-with-refresh';
import { useStudioConfig } from '@/domains/configuration/context/studio-config-state';

export interface TeamMember {
  id: string;
  email?: string;
  name?: string;
  avatarUrl?: string;
  role?: string;
  roles?: string[];
  permissions?: string[];
  lastActiveAt?: string;
  createdAt?: string;
}

export interface UseTeamMembersOptions {
  search?: string;
  limit?: number;
  offset?: number;
}

export interface UseTeamMembersResult {
  users: TeamMember[];
  total: number;
}

/**
 * Hook to fetch team members (internal users) from the studio auth provider.
 *
 * @example
 * ```tsx
 * const { data, isLoading, error } = useTeamMembers({ search: 'john' });
 * ```
 */
export function useTeamMembers(options: UseTeamMembersOptions = {}) {
  const { baseUrl, apiPrefix } = useStudioConfig();
  const { search, limit = 20, offset = 0 } = options;

  return useQuery<UseTeamMembersResult>({
    queryKey: ['team', 'members', { search, limit, offset }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (limit) params.set('limit', limit.toString());
      if (offset) params.set('offset', offset.toString());

      const url = `${baseUrl}${apiPrefix}/auth/team${params.toString() ? `?${params}` : ''}`;
      const response = await fetchWithRefresh(baseUrl, url, {
        headers: {
          'Content-Type': 'application/json',
          'x-mastra-client-type': 'studio',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch team members: ${response.statusText}`);
      }

      return response.json();
    },
    staleTime: 60_000, // 1 minute
  });
}
