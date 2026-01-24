import { useQuery } from '@tanstack/react-query';
import { useAdminClient } from '../use-admin-client';
import { useAuth } from '../use-auth';

export function useSources(teamId: string) {
  const client = useAdminClient();
  const { session } = useAuth();

  return useQuery({
    queryKey: ['sources', teamId],
    queryFn: () => client.sources.list(teamId),
    enabled: !!session?.access_token && !!teamId,
  });
}
