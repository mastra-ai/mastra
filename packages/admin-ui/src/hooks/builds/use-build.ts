import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAdminClient } from '../use-admin-client';
import { useAuth } from '../use-auth';

export function useBuild(buildId: string) {
  const client = useAdminClient();
  const { session } = useAuth();

  return useQuery({
    queryKey: ['build', buildId],
    queryFn: () => client.builds.get(buildId),
    enabled: !!session?.access_token && !!buildId,
  });
}

export function useBuildLogsQuery(buildId: string) {
  const client = useAdminClient();
  const { session } = useAuth();

  return useQuery({
    queryKey: ['build-logs', buildId],
    queryFn: () => client.builds.getLogs(buildId),
    enabled: !!session?.access_token && !!buildId,
  });
}

export function useCancelBuild(buildId: string) {
  const client = useAdminClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => client.builds.cancel(buildId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['build', buildId] });
    },
  });
}
