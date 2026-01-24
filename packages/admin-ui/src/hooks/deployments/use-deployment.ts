import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAdminClient } from '../use-admin-client';
import { useAuth } from '../use-auth';

export function useDeployment(deploymentId: string) {
  const client = useAdminClient();
  const { session } = useAuth();

  return useQuery({
    queryKey: ['deployment', deploymentId],
    queryFn: () => client.deployments.get(deploymentId),
    enabled: !!session?.access_token && !!deploymentId,
  });
}

export function useTriggerDeploy(deploymentId: string) {
  const client = useAdminClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => client.deployments.deploy(deploymentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deployment', deploymentId] });
      queryClient.invalidateQueries({ queryKey: ['builds', deploymentId] });
    },
  });
}

export function useStopDeployment(deploymentId: string) {
  const client = useAdminClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => client.deployments.stop(deploymentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deployment', deploymentId] });
    },
  });
}

export function useRestartDeployment(deploymentId: string) {
  const client = useAdminClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => client.deployments.restart(deploymentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deployment', deploymentId] });
      queryClient.invalidateQueries({ queryKey: ['builds', deploymentId] });
    },
  });
}

export function useRollbackDeployment(deploymentId: string) {
  const client = useAdminClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (buildId?: string) => client.deployments.rollback(deploymentId, buildId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deployment', deploymentId] });
      queryClient.invalidateQueries({ queryKey: ['builds', deploymentId] });
    },
  });
}
