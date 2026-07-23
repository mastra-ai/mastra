import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '../../../../../shared/api/keys';
import { useFactoriesQuery } from '../../../../../shared/hooks/useFactories';
import type { FactoryProject, FactoryProjectPayload } from '../services/github';

// Separate sessionStorage keys from onboarding so the two flows never collide.
const STEP_KEY = 'mastracode.factory-create.step';
const FACTORY_KEY = 'mastracode.factory-create.factory-id';

export type CreateFactoryFlowStep = 'name' | 'vcs' | 'model' | 'project-management';

interface CreateFactoryFlowState {
  step: CreateFactoryFlowStep;
  pendingFactory?: FactoryProject;
}

function readStep(): CreateFactoryFlowStep {
  const stored = sessionStorage.getItem(STEP_KEY);
  if (stored === 'vcs' || stored === 'model' || stored === 'project-management') return stored;
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
  return stored === 'vcs' || stored === 'model' || stored === 'project-management';
}

function persistState(step: CreateFactoryFlowStep, factoryId?: string): void {
  sessionStorage.setItem(STEP_KEY, step);
  if (factoryId) sessionStorage.setItem(FACTORY_KEY, factoryId);
  else sessionStorage.removeItem(FACTORY_KEY);
}

/**
 * State machine for the `/factories/create` wizard (Name → VCS → Model →
 * Project management). Mirrors the onboarding flow (`EmptyFactoryState`): the step and
 * pending factory id live in sessionStorage so a full-page OAuth redirect
 * (GitHub/Linear) can resume the flow where it left off. The pending factory
 * is resolved from the server-backed factories query —
 * `useCreateFactoryMutation` refetches it before resolving, so the lookup is
 * never stale when the flow advances.
 */
export function useCreateFactoryFlow() {
  const queryClient = useQueryClient();
  const factoriesQuery = useFactoriesQuery();
  const setState = useMutation({
    mutationFn: async ({ step, factoryId }: { step: CreateFactoryFlowStep; factoryId: string }) =>
      persistState(step, factoryId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.factoryCreateFlow() }),
  });
  const flowQuery = useQuery({
    queryKey: queryKeys.factoryCreateFlow(),
    enabled: !factoriesQuery.isPending,
    queryFn: () => {
      const step = readStep();
      const factoryId = sessionStorage.getItem(FACTORY_KEY);
      // Read the factories cache at execution time (not the render closure):
      // `useCreateFactoryMutation` refetches the list before resolving, and an
      // invalidation fired right after must see the newly created factory.
      const factories = queryClient.getQueryData<FactoryProject[]>(queryKeys.factories());
      const pendingFactory = factories?.find(factory => factory.id === factoryId);

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
    advanceToVcs: (pendingFactory: FactoryProject | FactoryProjectPayload) =>
      setState.mutateAsync({ step: 'vcs', factoryId: pendingFactory.id }),
    advanceToModel: (pendingFactory: FactoryProject | FactoryProjectPayload) =>
      setState.mutateAsync({ step: 'model', factoryId: pendingFactory.id }),
    advanceToProjectManagement: (pendingFactory: FactoryProject | FactoryProjectPayload) =>
      setState.mutateAsync({ step: 'project-management', factoryId: pendingFactory.id }),
    /** Re-persist the current state right before a full-page OAuth redirect. */
    persistBeforeRedirect: () => {
      const current = flowQuery.data;
      if (current) persistState(current.step, current.pendingFactory?.id);
    },
    /** Reset to the name step (unrestorable pending factory, or flow finished). */
    clear: clear.mutateAsync,
  };
}
