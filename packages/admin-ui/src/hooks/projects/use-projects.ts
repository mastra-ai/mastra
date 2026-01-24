import { useQuery } from '@tanstack/react-query';
import { useAdminClient } from '../use-admin-client';
import { useAuth } from '../use-auth';

export function useProjects(teamId: string, params?: { page?: number; perPage?: number }) {
  const client = useAdminClient();
  const { session } = useAuth();

  return useQuery({
    queryKey: ['projects', teamId, params],
    queryFn: () => client.projects.list(teamId, params),
    enabled: !!session?.access_token && !!teamId,
  });
}
