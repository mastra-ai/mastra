import { useQuery } from '@tanstack/react-query';
import { useAdminClient } from '../use-admin-client';
import { useAuth } from '../use-auth';

export interface UseSourcesParams {
  search?: string;
  type?: 'local' | 'github';
  page?: number;
  perPage?: number;
}

export function useSources(teamId: string, params?: UseSourcesParams) {
  const client = useAdminClient();
  const { session } = useAuth();

  return useQuery({
    queryKey: ['sources', teamId, params],
    queryFn: () => client.sources.list(teamId, params),
    enabled: !!session?.access_token && !!teamId,
  });
}
