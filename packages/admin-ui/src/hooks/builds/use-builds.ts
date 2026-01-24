import { useQuery } from '@tanstack/react-query';
import { useAdminClient } from '../use-admin-client';
import { useAuth } from '../use-auth';

export function useBuilds(deploymentId: string, params?: { page?: number; perPage?: number }) {
  const client = useAdminClient();
  const { session } = useAuth();

  return useQuery({
    queryKey: ['builds', deploymentId, params],
    queryFn: () => client.builds.list(deploymentId, params),
    enabled: !!session?.access_token && !!deploymentId,
  });
}
