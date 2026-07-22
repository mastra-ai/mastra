import { useMutation, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '../../../../../shared/api/keys';
import { useCreateFactoryMutation, useLinkRepositoryMutation } from '../../../../../shared/hooks/useFactories';
import { useFactoryOnboarding } from './useFactoryOnboarding';
import type { FactoryProject, GithubRepo } from '../services/github';

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
      const linkedRepository = await linkRepository.mutateAsync({
        factoryProjectId: factory.id,
        repo,
      });
      const linkedFactory: FactoryProject = {
        ...factory,
        repositories: [linkedRepository],
      };
      await queryClient.invalidateQueries({ queryKey: queryKeys.factories() });
      await onboarding.advanceToProjectManagement(linkedFactory);
    },
  });
}
