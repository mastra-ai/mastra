import { useQuery, useMutation } from '@tanstack/react-query';
import { useAdminClient } from '../use-admin-client';
import { useAuth } from '../use-auth';

export function useProjectSources(teamId: string) {
  const client = useAdminClient();
  const { session } = useAuth();

  return useQuery({
    queryKey: ['sources', teamId],
    queryFn: () => client.sources.list(teamId),
    enabled: !!session?.access_token && !!teamId,
  });
}

export function useProjectSource(sourceId: string) {
  const client = useAdminClient();
  const { session } = useAuth();

  return useQuery({
    queryKey: ['source', sourceId],
    queryFn: () => client.sources.get(sourceId),
    enabled: !!session?.access_token && !!sourceId,
  });
}

export function useValidateSource() {
  const client = useAdminClient();

  return useMutation({
    mutationFn: (sourceId: string) => client.sources.validate(sourceId),
  });
}
