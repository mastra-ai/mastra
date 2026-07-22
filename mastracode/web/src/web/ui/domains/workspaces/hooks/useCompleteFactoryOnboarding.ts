import { useMutation } from '@tanstack/react-query';

import { useActiveFactoryContext } from '../context/ActiveFactoryProvider';
import { useFactoryOnboarding } from './useFactoryOnboarding';

export function useCompleteFactoryOnboarding() {
  const { selectFactory } = useActiveFactoryContext();
  const onboarding = useFactoryOnboarding();

  return useMutation({
    mutationFn: async () => {
      const pendingFactory = onboarding.state?.pendingFactory;
      if (!pendingFactory) throw new Error('Your pending Factory could not be found. Choose a repository again.');

      await selectFactory(pendingFactory);
      await onboarding.complete();
      window.history.replaceState({}, '', '/factory/work');
    },
  });
}
