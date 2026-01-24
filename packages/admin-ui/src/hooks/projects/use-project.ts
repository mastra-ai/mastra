import { useQuery } from '@tanstack/react-query';
import { useAdminClient } from '../use-admin-client';
import { useAuth } from '../use-auth';

export function useProject(projectId: string) {
  const client = useAdminClient();
  const { session } = useAuth();

  return useQuery({
    queryKey: ['project', projectId],
    queryFn: () => client.projects.get(projectId),
    enabled: !!session?.access_token && !!projectId,
  });
}
