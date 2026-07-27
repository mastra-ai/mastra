import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import {
  connectInstallation,
  createFactoryProject,
  deleteFactoryProject,
  linkRepository,
  listFactoryProjects,
  unlinkRepository,
} from '../../web/ui/domains/workspaces/services/github';
import type { FactoryProject, GithubRepo } from '../../web/ui/domains/workspaces/services/github';

function invalidateFactories(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.factories() });
}

function refetchFactories(queryClient: ReturnType<typeof useQueryClient>) {
  return queryClient.refetchQueries({ queryKey: queryKeys.factories() });
}

async function fetchFactoryProjects(baseUrl: string): Promise<FactoryProject[]> {
  const projects = await listFactoryProjects(baseUrl);
  if (!projects) throw new Error('Failed to load Factories');
  return projects;
}

export function useFactoriesQuery() {
  const { baseUrl } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.factories(),
    queryFn: () => fetchFactoryProjects(baseUrl),
  });
}

export function useFactoryQuery(factoryId: string | undefined) {
  const { baseUrl } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.factories(),
    queryFn: () => fetchFactoryProjects(baseUrl),
    select: (factories: FactoryProject[]) => factories.find(factory => factory.id === factoryId),
    enabled: Boolean(factoryId),
  });
}

export function useCreateFactoryMutation() {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ name, description }: { name: string; description?: string }) =>
      createFactoryProject(baseUrl, name, description),
    onSuccess: () => refetchFactories(queryClient),
  });
}

/** @deprecated Use useCreateFactoryMutation. */
export const useAddFactoryMutation = useCreateFactoryMutation;

export function useLinkRepositoryMutation() {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ factoryProjectId, repo }: { factoryProjectId: string; repo: GithubRepo }) => {
      const connectionId = await connectInstallation(baseUrl, factoryProjectId, repo.installationStorageId);
      return linkRepository(baseUrl, factoryProjectId, connectionId, repo);
    },
    onSuccess: () => invalidateFactories(queryClient),
  });
}

export function useUnlinkRepositoryMutation() {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      factoryProjectId,
      projectRepositoryId,
    }: {
      factoryProjectId: string;
      projectRepositoryId: string;
    }) => unlinkRepository(baseUrl, factoryProjectId, projectRepositoryId),
    onSuccess: () => invalidateFactories(queryClient),
  });
}

export function useRemoveFactoryMutation() {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (factoryProjectId: string) => deleteFactoryProject(baseUrl, factoryProjectId),
    onSuccess: () => invalidateFactories(queryClient),
  });
}
