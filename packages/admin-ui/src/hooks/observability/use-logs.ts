import { useInfiniteQuery } from '@tanstack/react-query';
import { useAdminClient } from '../use-admin-client';
import { useAuth } from '../use-auth';
import type { LogQueryParams } from '@/types/api';

export function useLogs(projectId: string, params?: Omit<LogQueryParams, 'page'>) {
  const client = useAdminClient();
  const { session } = useAuth();

  return useInfiniteQuery({
    queryKey: ['logs', projectId, params],
    queryFn: ({ pageParam = 1 }) =>
      client.observability.logs.list(projectId, { ...params, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.page + 1 : undefined,
    enabled: !!session?.access_token && !!projectId,
  });
}
