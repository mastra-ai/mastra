import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAdminClient } from '../use-admin-client';
import { useAuth } from '../use-auth';

export function useEnvVars(projectId: string) {
  const client = useAdminClient();
  const { session } = useAuth();

  return useQuery({
    queryKey: ['env-vars', projectId],
    queryFn: () => client.projects.getEnvVars(projectId),
    enabled: !!session?.access_token && !!projectId,
  });
}

export function useSetEnvVar(projectId: string) {
  const client = useAdminClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { key: string; value: string; isSecret: boolean }) =>
      client.projects.setEnvVar(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['env-vars', projectId] });
    },
  });
}

export function useDeleteEnvVar(projectId: string) {
  const client = useAdminClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (key: string) => client.projects.deleteEnvVar(projectId, key),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['env-vars', projectId] });
    },
  });
}
