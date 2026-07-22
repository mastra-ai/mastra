import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '../../../../../shared/api/keys';
import { loadFactories } from '../services/factories';
import type { Factory } from '../services/factories';

// Separate sessionStorage keys from onboarding so the two flows never collide.
const STEP_KEY = 'mastracode.factory-create.step';
const FACTORY_KEY = 'mastracode.factory-create.factory-id';

export type CreateFactoryFlowStep = 'name' | 'vcs' | 'project-management';

interface CreateFactoryFlowState {
  step: CreateFactoryFlowStep;
  pendingFactory?: Factory;
}

function readStep(): CreateFactoryFlowStep {
  const stored = sessionStorage.getItem(STEP_KEY);
  if (stored === 'vcs' || stored === 'project-management') return stored;
  return 'name';
}

/**
 * Whether a create-factory flow is mid-way (used by `RootLanding` to route
 * OAuth callbacks back into `/factories/create` without touching the query
 * cache). Only steps past `name` count — merely visiting the page is not a
 * pending flow.
 */
export function hasPendingCreateFlow(): boolean {
  const stored = sessionStorage.getItem(STEP_KEY);
  return stored === 'vcs' || stored === 'project-management';
}

function persistState(state: CreateFactoryFlowState): CreateFactoryFlowState {
  sessionStorage.setItem(STEP_KEY, state.step);
  if (state.pendingFactory) sessionStorage.setItem(FACTORY_KEY, state.pendingFactory.id);
  else sessionStorage.removeItem(FACTORY_KEY);
  return state;
}

/**
 * State machine for the `/factories/create` wizard (Name → VCS → Project
 * management). Mirrors `useFactoryOnboarding`: the step and pending factory id
 * live in sessionStorage so a full-page OAuth redirect (GitHub/Linear) can
 * resume the flow where it left off.
 */
export function useCreateFactoryFlow() {
  const queryClient = useQueryClient();
  const setState = useMutation({
    mutationFn: (state: CreateFactoryFlowState) => Promise.resolve(persistState(state)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.factoryCreateFlow() }),
  });
  const flowQuery = useQuery({
    queryKey: queryKeys.factoryCreateFlow(),
    queryFn: () => {
      const step = readStep();
      const factoryId = sessionStorage.getItem(FACTORY_KEY);
      // Read persisted factories directly: the factory is created mid-flow, so
      // any cached factories query would be stale at the moment we advance.
      const pendingFactory = loadFactories().find(factory => factory.id === factoryId);

      return { step, pendingFactory } satisfies CreateFactoryFlowState;
    },
  });

  const clear = useMutation({
    mutationFn: async () => {
      sessionStorage.removeItem(STEP_KEY);
      sessionStorage.removeItem(FACTORY_KEY);
    },
    onSuccess: () => queryClient.setQueryData(queryKeys.factoryCreateFlow(), { step: 'name' }),
  });

  return {
    state: flowQuery.data,
    advanceToVcs: (pendingFactory: Factory) => setState.mutateAsync({ step: 'vcs', pendingFactory }),
    advanceToProjectManagement: (pendingFactory: Factory) =>
      setState.mutateAsync({ step: 'project-management', pendingFactory }),
    /** Re-persist the current state right before a full-page OAuth redirect. */
    persistBeforeRedirect: () => {
      const current = flowQuery.data;
      if (current) persistState(current);
    },
    /** Reset to the name step (unrestorable pending factory, or flow finished). */
    clear: clear.mutateAsync,
  };
}
