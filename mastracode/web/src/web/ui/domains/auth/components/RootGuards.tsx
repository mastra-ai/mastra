import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { useFactoryAuth } from '../../../../../shared/hooks/useFactoryAuth';
import { Navigate, Outlet, useLocation } from 'react-router';
import { ActiveFactoryProvider, useActiveFactoryContext } from '../../workspaces/context/ActiveFactoryProvider';
import { useEffect, useEffectEvent, useState } from 'react';

export const RootGuards = () => {
  return (
    <ActiveFactoryProvider>
      <AuthGuard />
    </ActiveFactoryProvider>
  );
};

const AuthGuard = () => {
  const auth = useFactoryAuth();

  if (auth.isPending) return <AuthPendingSkeleton />;

  // Local factory situation
  const state = auth.data;
  if (!state?.authEnabled) return <Outlet />;

  if (!state.authenticated) {
    const returnTo = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={`/signin?returnTo=${encodeURIComponent(returnTo)}`} replace />;
  }

  return <OnboardingGuard />;
};

const OnboardingGuard = () => {
  const pathname = useLocation().pathname;
  const { factoriesPending, factories } = useActiveFactoryContext();
  const { isActivatingInitialFactory } = useSetInitialFactoryWhenNoActive();

  if (isActivatingInitialFactory) return <AuthPendingSkeleton />;
  if (factoriesPending) return <AuthPendingSkeleton />;
  if (factories.length === 0 && pathname !== '/onboarding') return <Navigate to="/onboarding" replace />;

  return <Outlet />;
};

export function AuthPendingSkeleton({ label = 'Checking sign-in' }: { label?: string }) {
  return (
    <div role="status" aria-label={label} className="flex h-dvh w-full items-center justify-center bg-surface1">
      <div className="flex w-64 flex-col gap-3">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    </div>
  );
}

const useSetInitialFactoryWhenNoActive = () => {
  const { activeFactory, factoriesPending, factories, selectFactory } = useActiveFactoryContext();
  const [isPending, setPending] = useState(true);
  const firstFactory = factories[0];

  const setInitialFactoryWhenNoActiveEffect = useEffectEvent(() => {
    if (!firstFactory) return;

    selectFactory(firstFactory);
    setPending(false);
  });

  // Will be removed in favor of params, but for now, we'll set the initial factory selected for the first
  // factories when no active is set.
  // useEffect but well..
  const factoryCount = factories.length;
  const hasActiveFactory = Boolean(activeFactory);
  useEffect(() => {
    if (factoriesPending) return;
    if (factoryCount === 0 || hasActiveFactory) return setPending(false);

    setInitialFactoryWhenNoActiveEffect();
  }, [factoriesPending, factoryCount, hasActiveFactory]);

  return { isActivatingInitialFactory: isPending };
};
