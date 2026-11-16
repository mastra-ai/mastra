import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import {
  connectInstallation,
  createFactoryProject,
  deleteFactoryProject,
  isGitLabRepository,
  linkRepository,
  listFactoryProjects,
  unlinkRepository,
} from '../ui/domains/workspaces/services/github';
import type {
  FactoryProject,
  LinkedRepositoryPayload,
  SourceControlRepository,
} from '../ui/domains/workspaces/services/github';
import { registerGitLabRepository } from '../ui/domains/factory/services/gitlab';
import { fetchIntakeConfig, selectIntakeSource } from '../ui/domains/factory/services/intake';
import { useSaveIntakeSelectionMutation } from './useIntakeConfig';

function invalidateFactories(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.factories() });
}

function invalidateFactoryRepositories(queryClient: QueryClient, factoryProjectId: string) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.factories() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.factoryEnvironment(factoryProjectId) }),
  ]);
}

function refetchFactories(queryClient: ReturnType<typeof useQueryClient>) {
  return queryClient.refetchQueries({ queryKey: queryKeys.factories() });
}

async function fetchFactoryProjects(baseUrl: string): Promise<FactoryProject[]> {
  const projects = await listFactoryProjects(baseUrl);
  if (!projects) throw new Error('Failed to load Factories');
  return projects;
}

/** The signed-in user's Factories with their repositories, shared by every reader and the startup prefetch. */
export function factoriesQueryOptions(baseUrl: string) {
  return queryOptions({
    queryKey: queryKeys.factories(),
    queryFn: () => fetchFactoryProjects(baseUrl),
  });
}

export function useFactoriesQuery() {
  const { baseUrl } = useApiConfig();
  return useQuery(factoriesQueryOptions(baseUrl));
}

export function useFactoryQuery(factoryId: string | undefined) {
  const { baseUrl } = useApiConfig();
  return useQuery({
    ...factoriesQueryOptions(baseUrl),
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

// Link lands first so the list refreshes even if the intake write fails; the link is idempotent, so retry is safe.
export function useLinkRepositoryMutation() {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  const saveGithubSelection = useSaveIntakeSelectionMutation('github');
  const saveGitlabSelection = useSaveIntakeSelectionMutation('gitlab');
  return useMutation({
    mutationFn: async ({
      factoryProjectId,
      repo,
      selectIntake = true,
      onLinked,
    }: {
      factoryProjectId: string;
      repo: SourceControlRepository;
      /** Callers whose own switch decides the selection (onboarding's Work step) link with this off. */
      selectIntake?: boolean;
      onLinked?: (linked: LinkedRepositoryPayload) => Promise<void>;
    }) => {
      const gitlab = isGitLabRepository(repo);
      const linkableRepo = gitlab ? await registerGitLabRepository(baseUrl, repo.id) : repo;
      const connectionId = await connectInstallation(
        baseUrl,
        factoryProjectId,
        linkableRepo.installationStorageId,
        gitlab ? 'gitlab' : 'github',
      );
      const linked = await linkRepository(baseUrl, factoryProjectId, connectionId, linkableRepo);
      await onLinked?.(linked);
      // Refresh the list alongside the intake write and wait for both, so the row
      // goes straight from "Linking…" to linked instead of flashing "Link" first.
      const refreshed = invalidateFactoryRepositories(queryClient, factoryProjectId);
      try {
        if (selectIntake) {
          const config = await fetchIntakeConfig(baseUrl);
          if (gitlab) {
            const gitlabSelection = selectIntakeSource(config.gitlab, repo.id);
            if (gitlabSelection !== config.gitlab) await saveGitlabSelection.mutateAsync(gitlabSelection);
          } else {
            const githubSelection = selectIntakeSource(config.github, repo.fullName);
            if (githubSelection !== config.github) await saveGithubSelection.mutateAsync(githubSelection);
          }
        }
      } finally {
        await refreshed;
      }
      return linked;
    },
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
    onSuccess: (_data, { factoryProjectId }) => invalidateFactoryRepositories(queryClient, factoryProjectId),
  });
}

export function useDeleteFactoryMutation() {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (factoryProjectId: string) => deleteFactoryProject(baseUrl, factoryProjectId),
    onSuccess: () => invalidateFactories(queryClient),
  });
}
