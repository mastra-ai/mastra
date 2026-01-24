import { useQuery } from '@tanstack/react-query';
import { useAdminClient } from '../use-admin-client';
import { useAuth } from '../use-auth';
import type { MetricQueryParams } from '@/types/api';

export function useMetrics(projectId: string, params?: MetricQueryParams) {
  const client = useAdminClient();
  const { session } = useAuth();

  return useQuery({
    queryKey: ['metrics', projectId, params],
    queryFn: () => client.observability.metrics.get(projectId, params),
    enabled: !!session?.access_token && !!projectId,
  });
}
