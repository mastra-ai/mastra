import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useAdminClient } from '../use-admin-client';
import { useAuth } from '../use-auth';
import type { TraceQueryParams } from '@/types/api';

export function useTraces(projectId: string, params?: Omit<TraceQueryParams, 'page'>) {
  const client = useAdminClient();
  const { session } = useAuth();

  return useInfiniteQuery({
    queryKey: ['traces', projectId, params],
    queryFn: ({ pageParam = 1 }) =>
      client.observability.traces.list(projectId, { ...params, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.page + 1 : undefined,
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
