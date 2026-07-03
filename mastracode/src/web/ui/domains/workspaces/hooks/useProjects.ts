import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '../../../../../shared/api/keys';
import { createProjectFromRepo } from '../services/github';
import type { GithubRepo } from '../services/github';
import { addGithubProject, addProject, ensureResourceId, loadProjects, removeProject } from '../services/projects';
import type { Project } from '../services/projects';

function invalidateProjects(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.projects() });
}

export function useProjectsQuery() {
  return useQuery({
    queryKey: queryKeys.projects(),
    queryFn: loadProjects,
    initialData: loadProjects,
  });
}

export function useAddProjectMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ name, path }: { name: string; path: string }) => addProject(name, path),
    onSuccess: () => invalidateProjects(queryClient),
  });
}

export function useRemoveProjectMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      removeProject(id);
    },
    onSuccess: () => invalidateProjects(queryClient),
  });
}

export function useEnsureResourceIdMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (project: Project) => ensureResourceId(project),
    onSuccess: () => invalidateProjects(queryClient),
  });
}

export function useCreateGithubProjectMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (repo: GithubRepo) => addGithubProject(await createProjectFromRepo(repo)),
    onSuccess: () => invalidateProjects(queryClient),
  });
}
