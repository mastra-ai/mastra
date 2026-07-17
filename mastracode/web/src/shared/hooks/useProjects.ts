import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import { createProjectFromRepo } from '../../web/ui/domains/workspaces/services/github';
import type { GithubRepo } from '../../web/ui/domains/workspaces/services/github';
import {
  addGithubProject,
  addProject,
  ensureResourceId,
  loadProjects,
  loadProjectsWithResolvedIds,
  removeProject,
} from '../../web/ui/domains/workspaces/services/projects';
import type { Project } from '../../web/ui/domains/workspaces/services/projects';

function invalidateProjects(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.projects() });
}

export function useProjectsQuery() {
  const { baseUrl } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.projects(),
    queryFn: () => loadProjectsWithResolvedIds(baseUrl),
    initialData: loadProjects,
  });
}

export function useAddProjectMutation() {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ name, path }: { name: string; path: string }) => addProject(baseUrl, name, path),
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
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (project: Project) => ensureResourceId(baseUrl, project),
    onSuccess: () => invalidateProjects(queryClient),
  });
}

export function useCreateGithubProjectMutation() {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (repo: GithubRepo) => addGithubProject(await createProjectFromRepo(baseUrl, repo)),
    onSuccess: () => invalidateProjects(queryClient),
  });
}
