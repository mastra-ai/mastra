import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchWithRefresh } from '@/domains/auth/hooks/fetch-with-refresh';
import { useStudioConfig } from '@/domains/configuration/context/studio-config-state';

export interface RoleDefinition {
  id: string;
  name: string;
  description?: string;
  permissions: string[];
}

/**
 * Hook to fetch available roles from the RBAC provider.
 *
 * @example
 * ```tsx
 * const { data: roles, isLoading } = useRoles();
 * ```
 */
export function useRoles() {
  const { baseUrl, apiPrefix } = useStudioConfig();

  return useQuery<RoleDefinition[]>({
    queryKey: ['roles'],
    queryFn: async () => {
      const url = `${baseUrl}${apiPrefix}/auth/roles`;
      const response = await fetchWithRefresh(baseUrl, url, {
        headers: {
          'Content-Type': 'application/json',
          'x-mastra-client-type': 'studio',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch roles: ${response.statusText}`);
      }

      const data = await response.json();
      return data.roles || [];
    },
    staleTime: 5 * 60_000, // 5 minutes
  });
}

/**
 * Hook to fetch roles assigned to a specific user.
 *
 * @example
 * ```tsx
 * const { data: userRoles } = useUserRoles('user_123');
 * ```
 */
export function useUserRoles(userId: string) {
  const { baseUrl, apiPrefix } = useStudioConfig();

  return useQuery<string[]>({
    queryKey: ['user', userId, 'roles'],
    queryFn: async () => {
      const url = `${baseUrl}${apiPrefix}/auth/team/${userId}/roles`;
      const response = await fetchWithRefresh(baseUrl, url, {
        headers: {
          'Content-Type': 'application/json',
          'x-mastra-client-type': 'studio',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch user roles: ${response.statusText}`);
      }

      const data = await response.json();
      return data.roles || [];
    },
    enabled: !!userId,
    staleTime: 60_000, // 1 minute
  });
}

/**
 * Hook to assign a role to a user.
 *
 * @example
 * ```tsx
 * const { mutate: assignRole } = useAssignRole();
 * assignRole({ userId: 'user_123', roleId: 'admin' });
 * ```
 */
export function useAssignRole() {
  const { baseUrl, apiPrefix } = useStudioConfig();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, roleId }: { userId: string; roleId: string }) => {
      const url = `${baseUrl}${apiPrefix}/auth/team/${userId}/roles/${roleId}`;
      const response = await fetchWithRefresh(baseUrl, url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-mastra-client-type': 'studio',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Failed to assign role: ${response.statusText}`);
      }

      return response.json();
    },
    onSuccess: (_, { userId }) => {
      // Invalidate user roles query to refetch
      void queryClient.invalidateQueries({ queryKey: ['user', userId, 'roles'] });
    },
  });
}

/**
 * Hook to remove a role from a user.
 *
 * @example
 * ```tsx
 * const { mutate: removeRole } = useRemoveRole();
 * removeRole({ userId: 'user_123', roleId: 'admin' });
 * ```
 */
export function useRemoveRole() {
  const { baseUrl, apiPrefix } = useStudioConfig();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, roleId }: { userId: string; roleId: string }) => {
      const url = `${baseUrl}${apiPrefix}/auth/team/${userId}/roles/${roleId}`;
      const response = await fetchWithRefresh(baseUrl, url, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'x-mastra-client-type': 'studio',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Failed to remove role: ${response.statusText}`);
      }

      return response.json();
    },
    onSuccess: (_, { userId }) => {
      // Invalidate user roles query to refetch
      void queryClient.invalidateQueries({ queryKey: ['user', userId, 'roles'] });
    },
  });
}
