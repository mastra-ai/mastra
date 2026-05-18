import { useMastraClient } from '@mastra/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useStudioConfig } from '@/domains/configuration/context/studio-config-context';

export interface FGAResource {
  id: string;
  externalId?: string;
  name: string;
  description?: string;
  resourceTypeSlug: string;
  organizationId?: string;
  parentResourceId?: string;
}

export interface FGACapabilities {
  resourceManagement: boolean;
  roleAssignment: boolean;
  hierarchicalResources: boolean;
}

interface FGAResourcesResponse {
  resources: FGAResource[];
  capabilities: FGACapabilities | null;
}

/**
 * Hook to list FGA resources.
 */
export function useFGAResources(resourceType?: string, search?: string) {
  const client = useMastraClient();
  const { baseUrl, apiPrefix } = useStudioConfig();

  return useQuery<FGAResourcesResponse>({
    queryKey: ['fga', 'resources', resourceType, search],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (resourceType) params.set('resourceType', resourceType);
      if (search) params.set('search', search);

      const url = `${baseUrl}${apiPrefix}/auth/fga/resources${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await fetch(url, {
        credentials: 'include',
        headers: {
          ...(client.options as any).headers,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch FGA resources: ${response.status}`);
      }

      return response.json();
    },
    staleTime: 30 * 1000,
  });
}

/**
 * Hook to create an FGA resource.
 */
export function useCreateFGAResource() {
  const client = useMastraClient();
  const queryClient = useQueryClient();
  const { baseUrl, apiPrefix } = useStudioConfig();

  return useMutation({
    mutationFn: async (resource: Omit<FGAResource, 'id'>) => {
      const url = `${baseUrl}${apiPrefix}/auth/fga/resources`;
      const response = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: {
          ...(client.options as any).headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(resource),
      });

      if (!response.ok) {
        throw new Error(`Failed to create FGA resource: ${response.status}`);
      }

      return response.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['fga', 'resources'] });
    },
  });
}

/**
 * Hook to delete an FGA resource.
 */
export function useDeleteFGAResource() {
  const client = useMastraClient();
  const queryClient = useQueryClient();
  const { baseUrl, apiPrefix } = useStudioConfig();

  return useMutation({
    mutationFn: async (resourceId: string) => {
      const url = `${baseUrl}${apiPrefix}/auth/fga/resources/${resourceId}`;
      const response = await fetch(url, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          ...(client.options as any).headers,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to delete FGA resource: ${response.status}`);
      }

      return response.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['fga', 'resources'] });
    },
  });
}
