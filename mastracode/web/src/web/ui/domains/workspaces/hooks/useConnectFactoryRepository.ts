import { useMutation, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '../../../../../shared/api/keys';
import { useCreateFactoryMutation, useLinkRepositoryMutation } from '../../../../../shared/hooks/useFactories';
import type { FactoryProject, FactoryProjectPayload, GithubRepo } from '../services/github';

export interface ConnectFactoryRepositoryOptions {
  /**
   * Already-created factory to link the repository into. When absent, a
   * factory is created from the repository name (onboarding-style flow).
   */
  pendingFactory?: FactoryProject | FactoryProjectPayload;
  /** Called when a factory had to be created from the repo name (no `pendingFactory`). */
  onFactoryCreated?: (factory: FactoryProjectPayload) => Promise<unknown>;
  /** Called after the repository is linked and the factories cache refreshed. */
  onLinked?: (factory: FactoryProject) => Promise<unknown>;
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
      const linkedRepository = await linkRepository.mutateAsync({
        factoryProjectId: factory.id,
        repo,
      });
      const linkedFactory: FactoryProject = {
        ...factory,
        repositories: [linkedRepository],
      };
      await queryClient.invalidateQueries({ queryKey: queryKeys.factories() });
      await onLinked?.(linkedFactory);
    },
  });
}
