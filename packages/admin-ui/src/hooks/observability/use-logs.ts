import { useQuery } from '@tanstack/react-query';
import { useAdminClient } from '../use-admin-client';
import { useAuth } from '../use-auth';
import type { LogQueryParams } from '@/types/api';

export function useLogs(projectId: string, params?: LogQueryParams) {
  const client = useAdminClient();
  const { session } = useAuth();

  return useQuery({
    queryKey: ['logs', projectId, params],
    queryFn: () => client.observability.logs.list(projectId, params),
    enabled: !!session?.access_token && !!projectId,
  });
}
