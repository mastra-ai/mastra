import { useMutation, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '../../../../../shared/api/keys';
import { useCreateFactoryMutation, useLinkRepositoryMutation } from '../../../../../shared/hooks/useFactories';
import { useFactoryOnboarding } from './useFactoryOnboarding';
import { saveFactories } from '../services/factories';
import type { Factory } from '../services/factories';
import type { GithubRepo } from '../services/github';

export function useConnectFactoryRepository() {
  const queryClient = useQueryClient();
  const createFactory = useCreateFactoryMutation();
  const linkRepository = useLinkRepositoryMutation();
  const onboarding = useFactoryOnboarding();

  return useMutation({
    mutationFn: async (repo: GithubRepo) => {
      const pendingFactory = onboarding.state?.pendingFactory;
      const factory = pendingFactory ?? (await createFactory.mutateAsync({ name: repo.name }));
      if (!pendingFactory) await onboarding.recordPendingFactory(factory);
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
      await onboarding.advanceToProjectManagement(linkedFactory);
    },
  });
}
