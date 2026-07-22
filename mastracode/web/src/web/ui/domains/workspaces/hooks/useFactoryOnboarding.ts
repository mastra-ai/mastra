import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '../../../../../shared/api/keys';
import { useFactoriesQuery } from '../../../../../shared/hooks/useFactories';
import type { FactoryProject, FactoryProjectPayload } from '../services/github';

const STEP_KEY = 'mastracode.factory-onboarding.step';
const FACTORY_KEY = 'mastracode.factory-onboarding.factory-id';

export type FactoryOnboardingStep = 'initial' | 'vcs' | 'project-management';

interface FactoryOnboardingState {
  step: FactoryOnboardingStep;
  pendingFactory?: FactoryProject | FactoryProjectPayload;
}

function readStep(): FactoryOnboardingStep {
  const stored = sessionStorage.getItem(STEP_KEY);
  if (stored === 'vcs' || stored === 'project-management') return stored;
  return 'initial';
}

function persistState(state: FactoryOnboardingState): FactoryOnboardingState {
  sessionStorage.setItem(STEP_KEY, state.step);
  if (state.pendingFactory) sessionStorage.setItem(FACTORY_KEY, state.pendingFactory.id);
  else sessionStorage.removeItem(FACTORY_KEY);
  return state;
}

export function useFactoryOnboarding() {
  const queryClient = useQueryClient();
  const factoriesQuery = useFactoriesQuery();
  const setState = useFactoryOnboardingSetState();
  const onboardingQuery = useQuery({
    queryKey: queryKeys.factoryOnboarding(),
    enabled: !factoriesQuery.isPending,
    queryFn: () => {
      const step = readStep();
      const factoryId = sessionStorage.getItem(FACTORY_KEY);
      const pendingFactory = factoriesQuery.data?.find(factory => factory.id === factoryId);

      return { step, pendingFactory } satisfies FactoryOnboardingState;
    },
  });

  const complete = useMutation({
    mutationFn: async () => {
      sessionStorage.removeItem(STEP_KEY);
      sessionStorage.removeItem(FACTORY_KEY);
    },
    onSuccess: () => queryClient.setQueryData(queryKeys.factoryOnboarding(), { step: 'initial' }),
  });

  return {
    state: onboardingQuery.data,
    advanceToVcs: () => setState.mutate({ step: 'vcs' }),
    persistVcsRedirect: () => setState.mutate({ step: 'vcs', pendingFactory: onboardingQuery.data?.pendingFactory }),
    advanceToProjectManagement: (pendingFactory: FactoryProject | FactoryProjectPayload) =>
      setState.mutateAsync({ step: 'project-management', pendingFactory }),
    persistProjectManagementRedirect: () => {
      const pendingFactory = onboardingQuery.data?.pendingFactory;
      if (pendingFactory) setState.mutate({ step: 'project-management', pendingFactory });
    },
    recordPendingFactory: (pendingFactory: FactoryProject | FactoryProjectPayload) =>
      setState.mutateAsync({ step: 'vcs', pendingFactory }),
    complete: complete.mutateAsync,
  };
}

export const useFactoryOnboardingSetState = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (state: FactoryOnboardingState) => Promise.resolve(persistState(state)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.factoryOnboarding() }),
  });
};
