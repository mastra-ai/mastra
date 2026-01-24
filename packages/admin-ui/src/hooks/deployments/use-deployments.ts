import { useQuery } from '@tanstack/react-query';
import { useAdminClient } from '../use-admin-client';
import { useAuth } from '../use-auth';

export function useDeployments(projectId: string, params?: { page?: number; perPage?: number }) {
  const client = useAdminClient();
  const { session } = useAuth();

  return useQuery({
    queryKey: ['deployments', projectId, params],
    queryFn: () => client.deployments.list(projectId, params),
    enabled: !!session?.access_token && !!projectId,
  });
}
