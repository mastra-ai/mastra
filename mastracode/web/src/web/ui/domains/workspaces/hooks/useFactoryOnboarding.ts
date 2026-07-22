import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { queryKeys } from '../../../../../shared/api/keys';
import { useLoadFactories } from '../../../../../shared/hooks/useFactories';
import type { Factory } from '../services/factories';

const STEP_KEY = 'mastracode.factory-onboarding.step';
const FACTORY_KEY = 'mastracode.factory-onboarding.factory-id';

export type FactoryOnboardingStep = 'initial' | 'vcs' | 'project-management';

interface FactoryOnboardingState {
  step: FactoryOnboardingStep;
  pendingFactory?: Factory;
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
  const factoriesQuery = useLoadFactories();
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
    advanceToProjectManagement: (pendingFactory: Factory) =>
      setState.mutateAsync({ step: 'project-management', pendingFactory }),
    persistProjectManagementRedirect: () => {
      const pendingFactory = onboardingQuery.data?.pendingFactory;
      if (pendingFactory) setState.mutate({ step: 'project-management', pendingFactory });
    },
    recordPendingFactory: (pendingFactory: Factory) => setState.mutateAsync({ step: 'vcs', pendingFactory }),
    complete: complete.mutateAsync,
  };
}

export const useFactoryOnboardingSetState = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (state: FactoryOnboardingState) => Promise.resolve(persistState(state)),
    onSuccess: state => queryClient.invalidateQueries({ queryKey: queryKeys.factoryOnboarding() }),
  });
};
