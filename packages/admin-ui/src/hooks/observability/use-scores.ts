import { useQuery } from '@tanstack/react-query';
import { useAdminClient } from '../use-admin-client';
import { useAuth } from '../use-auth';
import type { ScoreQueryParams } from '@/types/api';

export function useScores(projectId: string, params?: ScoreQueryParams) {
  const client = useAdminClient();
  const { session } = useAuth();

  return useQuery({
    queryKey: ['scores', projectId, params],
    queryFn: () => client.observability.scores.list(projectId, params),
    enabled: !!session?.access_token && !!projectId,
  });
}
