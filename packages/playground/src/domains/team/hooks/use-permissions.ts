import { useQuery } from '@tanstack/react-query';
import { useStudioConfig } from '@/domains/configuration/context/studio-config-state';

/**
 * Permission info returned from the API.
 */
export interface PermissionInfo {
  /** Permission pattern (e.g., 'agents:read', '*:write') */
  value: string;
  /** Human-readable label (e.g., 'Agents: Read') */
  label: string;
  /** Description of what this permission allows */
  description: string;
  /** Resource name (e.g., 'agents') - null for wildcards */
  resource: string | null;
  /** Action name (e.g., 'read') - null for resource wildcards */
  action: string | null;
  /** Whether this is a wildcard permission */
  isWildcard: boolean;
}

interface PermissionsResponse {
  permissions: PermissionInfo[];
}

/**
 * Fetches available permissions from the server.
 * These are generated from SERVER_ROUTES and include proper labels/descriptions.
 */
export function useAvailablePermissions() {
  const { baseUrl, apiPrefix } = useStudioConfig();

  const { data, error, isLoading, refetch } = useQuery<PermissionsResponse>({
    queryKey: ['auth', 'permissions'],
    queryFn: async () => {
      const response = await fetch(`${baseUrl}${apiPrefix}/auth/permissions`, {
        credentials: 'include',
        headers: {
          'x-mastra-client-type': 'studio',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const error = new Error(errorData.message || 'Failed to fetch permissions');
        (error as any).status = response.status;
        throw error;
      }

      return response.json();
    },
    staleTime: 60000, // Cache for 1 minute
  });

  return {
    permissions: data?.permissions ?? [],
    isLoading,
    error,
    refresh: refetch,
  };
}
