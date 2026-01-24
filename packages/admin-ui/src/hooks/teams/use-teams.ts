import { useQuery } from '@tanstack/react-query';
import { useAdminClient } from '../use-admin-client';
import { useAuth } from '../use-auth';

export function useTeams(params?: { page?: number; perPage?: number }) {
  const client = useAdminClient();
  const { session } = useAuth();

  return useQuery({
    queryKey: ['teams', params],
    queryFn: () => client.teams.list(params),
    enabled: !!session?.access_token,
  });
}
