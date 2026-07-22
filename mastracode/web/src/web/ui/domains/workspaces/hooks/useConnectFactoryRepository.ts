import { useMutation, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '../../../../../shared/api/keys';
import { useCreateFactoryMutation, useLinkRepositoryMutation } from '../../../../../shared/hooks/useFactories';
import { saveFactories } from '../services/factories';
import type { Factory } from '../services/factories';
import type { GithubRepo } from '../services/github';

export interface ConnectFactoryRepositoryOptions {
  /**
   * Already-created factory to link the repository into. When absent, a
   * factory is created from the repository name (onboarding-style flow).
   */
  pendingFactory?: Factory;
  /** Called when a factory had to be created from the repo name (no `pendingFactory`). */
  onFactoryCreated?: (factory: Factory) => Promise<unknown>;
  /** Called after the repository is linked and the factories cache refreshed. */
  onLinked?: (factory: Factory) => Promise<unknown>;
}

/**
 * Link a GitHub repository to a factory. The flow state is injected via
 * callbacks so both the onboarding flow and the `/factories/create` wizard can
 * share one linking implementation while advancing their own state machines.
 */
export function useConnectFactoryRepository({
  pendingFactory,
  onFactoryCreated,
  onLinked,
}: ConnectFactoryRepositoryOptions) {
  const queryClient = useQueryClient();
  const createFactory = useCreateFactoryMutation();
  const linkRepository = useLinkRepositoryMutation();

  return useMutation({
    mutationFn: async (repo: GithubRepo) => {
      const factory = pendingFactory ?? (await createFactory.mutateAsync({ name: repo.name }));
      if (!pendingFactory) await onFactoryCreated?.(factory);
      if (factory.binding.kind !== 'factory') return;

      const linkedRepository = await linkRepository.mutateAsync({
        factoryProjectId: factory.binding.factoryProjectId,
        repo,
      });
      const linkedFactory = {
        ...factory,
        binding: {
          ...factory.binding,
          selectedRepositoryId: linkedRepository.projectRepositoryId,
          repositories: [{ ...linkedRepository, worktrees: [] }],
        },
      };
      const factories = queryClient.getQueryData<Factory[]>(queryKeys.factories()) ?? [];
      saveFactories([...factories.filter(item => item.id !== linkedFactory.id), linkedFactory]);
      await queryClient.invalidateQueries({ queryKey: queryKeys.factories() });
      await onLinked?.(linkedFactory);
    },
  });
}
