import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAdminClient } from '../use-admin-client';
import type { CreateProjectInput } from '@/types/api';

interface CreateProjectArgs {
  teamId: string;
  data: CreateProjectInput;
}

export function useCreateProject() {
  const client = useAdminClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ teamId, data }: CreateProjectArgs) => client.projects.create(teamId, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['projects', variables.teamId] });
    },
  });
}

export function useUpdateProject(projectId: string) {
  const client = useAdminClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Partial<{ name: string; defaultBranch: string }>) => client.projects.update(projectId, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      if (data?.teamId) {
        queryClient.invalidateQueries({ queryKey: ['projects', data.teamId] });
      }
    },
  });
}

export function useDeleteProject() {
  const client = useAdminClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, teamId }: { projectId: string; teamId: string }) =>
      client.projects.delete(projectId).then(() => ({ projectId, teamId })),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['projects', variables.teamId] });
      queryClient.removeQueries({ queryKey: ['project', variables.projectId] });
    },
  });
}
