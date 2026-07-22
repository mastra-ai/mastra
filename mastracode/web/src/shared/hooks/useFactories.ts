import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import {
  connectInstallation,
  createFactoryProject,
  linkRepository,
  unlinkRepository,
} from '../../web/ui/domains/workspaces/services/github';
import type { GithubRepo } from '../../web/ui/domains/workspaces/services/github';
import {
  addLocalFactory,
  addServerFactory,
  loadFactories,
  loadFactoriesWithResolvedIds,
  removeFactory,
} from '../../web/ui/domains/workspaces/services/factories';

function invalidateFactories(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.factories() });
}

export function useLoadFactories() {
  return useQuery({
    queryKey: queryKeys.persistedFactories(),
    queryFn: () => Promise.resolve(loadFactories()),
  });
}

export function useFactoriesQuery() {
  const { baseUrl } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.factories(),
    queryFn: () => loadFactoriesWithResolvedIds(baseUrl),
  });
}

/** Bind a local folder as a factory (secondary onboarding path). */
export function useAddFactoryMutation() {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ name, path }: { name: string; path: string }) => addLocalFactory(baseUrl, name, path),
    onSuccess: () => invalidateFactories(queryClient),
  });
}

/**
 * Create a named server-backed Factory project (the primary onboarding path).
 * The new factory starts with zero linked repositories — repositories are
 * connected afterwards from the Board or Factory settings.
 */
export function useCreateFactoryMutation() {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, description }: { name: string; description?: string }) =>
      addServerFactory(await createFactoryProject(baseUrl, name, description)),
    onSuccess: () => invalidateFactories(queryClient),
  });
}

/**
 * Link a GitHub repository to a Factory project: ensures a source-control
 * connection exists for the repo's installation (reusing one when present),
 * then links the repository under it.
 */
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

/** Unlink a repository from its Factory project. */
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
    mutationFn: (id: string) => removeFactory(baseUrl, id),
    onSuccess: () => {
      queryClient.setQueryData(queryKeys.factories(), loadFactories());
      invalidateFactories(queryClient);
    },
  });
}
