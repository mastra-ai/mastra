import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAdminClient } from '../use-admin-client';
import type { CreateDeploymentInput } from '@/types/api';

interface CreateDeploymentArgs {
  projectId: string;
  data: CreateDeploymentInput;
}

export function useCreateDeployment() {
  const client = useAdminClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, data }: CreateDeploymentArgs) => client.deployments.create(projectId, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['deployments', variables.projectId] });
    },
  });
}

export function useUpdateDeployment(deploymentId: string) {
  const client = useAdminClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Partial<{ autoShutdown: boolean }>) => client.deployments.update(deploymentId, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['deployment', deploymentId] });
      if (data?.projectId) {
        queryClient.invalidateQueries({ queryKey: ['deployments', data.projectId] });
      }
    },
  });
}

export function useDeleteDeployment() {
  const client = useAdminClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ deploymentId, projectId }: { deploymentId: string; projectId: string }) =>
      client.deployments.delete(deploymentId).then(() => ({ deploymentId, projectId })),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['deployments', variables.projectId] });
      queryClient.removeQueries({ queryKey: ['deployment', variables.deploymentId] });
    },
  });
}
