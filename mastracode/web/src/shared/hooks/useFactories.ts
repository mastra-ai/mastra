import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import { createConnectedRepository } from '../../web/ui/domains/workspaces/services/github';
import type { GithubRepo } from '../../web/ui/domains/workspaces/services/github';
import {
  addGithubFactory,
  addLocalFactory,
  loadFactories,
  loadFactoriesWithResolvedIds,
  removeFactory,
} from '../../web/ui/domains/workspaces/services/factories';

function invalidateFactories(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.factories() });
}

export function useFactoriesQuery() {
  const { baseUrl } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.factories(),
    queryFn: () => loadFactoriesWithResolvedIds(baseUrl),
    initialData: loadFactories,
  });
}

export function useAddFactoryMutation() {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ name, path }: { name: string; path: string }) => addLocalFactory(baseUrl, name, path),
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

export function useCreateGithubFactoryMutation() {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (repo: GithubRepo) => addGithubFactory(await createConnectedRepository(baseUrl, repo)),
    onSuccess: () => invalidateFactories(queryClient),
  });
}
