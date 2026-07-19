import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import { createProjectFromRepo } from '../../web/ui/domains/workspaces/services/github';
import type { GithubRepo } from '../../web/ui/domains/workspaces/services/github';
import {
  addProject,
  ensureResourceId,
  loadLocalProjects,
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
    initialData: loadLocalProjects,
    initialDataUpdatedAt: 0,
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
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => removeProject(baseUrl, id),
    onSuccess: () => {
      queryClient.setQueryData(queryKeys.projects(), loadProjects());
      invalidateProjects(queryClient);
    },
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
    mutationFn: (repo: GithubRepo) => createProjectFromRepo(baseUrl, repo),
    onSuccess: () => invalidateProjects(queryClient),
  });
}
