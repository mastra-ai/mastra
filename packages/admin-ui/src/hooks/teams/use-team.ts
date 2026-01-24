import { useQuery } from '@tanstack/react-query';
import { useAdminClient } from '../use-admin-client';
import { useAuth } from '../use-auth';

export function useTeam(teamId: string) {
  const client = useAdminClient();
  const { session } = useAuth();

  return useQuery({
    queryKey: ['team', teamId],
    queryFn: () => client.teams.get(teamId),
    enabled: !!session?.access_token && !!teamId,
  });
}
