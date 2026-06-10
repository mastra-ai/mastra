import { useQuery } from '@tanstack/react-query';
import type { TeamMember } from './use-team-members';
import { fetchWithRefresh } from '@/domains/auth/hooks/fetch-with-refresh';
import { useStudioConfig } from '@/domains/configuration/context/studio-config-state';

export interface UseTeamMemberOptions {
  enabled?: boolean;
}

/**
 * Hook to fetch a single team member by ID.
 *
 * @example
 * ```tsx
 * const { data, isLoading, error } = useTeamMember('user_123');
 * const { data } = useTeamMember('user_123', { enabled: isOpen });
 * ```
 */
export function useTeamMember(userId: string, options: UseTeamMemberOptions = {}) {
  const { baseUrl, apiPrefix } = useStudioConfig();
  const { enabled = true } = options;

  return useQuery<TeamMember>({
    queryKey: ['team', 'member', userId],
    queryFn: async () => {
      const url = `${baseUrl}${apiPrefix}/auth/team/${userId}`;
      const response = await fetchWithRefresh(baseUrl, url, {
        headers: {
          'Content-Type': 'application/json',
          'x-mastra-client-type': 'studio',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch team member: ${response.statusText}`);
      }

      return response.json();
    },
    enabled: !!userId && enabled,
    staleTime: 60_000, // 1 minute
  });
}
