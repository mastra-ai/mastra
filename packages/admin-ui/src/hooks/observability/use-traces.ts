import { useQuery } from '@tanstack/react-query';
import { useAdminClient } from '../use-admin-client';
import { useAuth } from '../use-auth';
import type { TraceQueryParams } from '@/types/api';

export function useTraces(projectId: string, params?: TraceQueryParams) {
  const client = useAdminClient();
  const { session } = useAuth();

  return useQuery({
    queryKey: ['traces', projectId, params],
    queryFn: () => client.observability.traces.list(projectId, params),
    enabled: !!session?.access_token && !!projectId,
  });
}

export function useTrace(traceId: string) {
  const client = useAdminClient();
  const { session } = useAuth();

  return useQuery({
    queryKey: ['trace', traceId],
    queryFn: () => client.observability.traces.get(traceId),
    enabled: !!session?.access_token && !!traceId,
  });
}
