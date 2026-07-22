import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { useFactoryAuth } from '../../../../../shared/hooks/useFactoryAuth';
import { useFactoriesQuery } from '../../../../../shared/hooks/useFactories';
import { Navigate, Outlet, useLocation } from 'react-router';

export const RootGuards = () => {
  return <AuthGuard />;
};

const AuthGuard = () => {
  const auth = useFactoryAuth();
  const location = useLocation();

  if (auth.isPending) return <AuthPendingSkeleton />;
  if (auth.isError) return <AuthPendingSkeleton label="Unable to reach MastraCode server" />;

  // Local factory situation
  const state = auth.data;
  if (!state?.authEnabled) return <OnboardingGuard />;

  if (!state.authenticated) {
    // Router location (not window.location) so memory routers and in-app
    // navigations produce the correct returnTo.
    const returnTo = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={`/signin?returnTo=${encodeURIComponent(returnTo)}`} replace />;
  }

  return <OnboardingGuard />;
};

const OnboardingGuard = () => {
  const pathname = useLocation().pathname;
  const { data: factories, isPending: factoriesPending } = useFactoriesQuery();

  if (factoriesPending) return <AuthPendingSkeleton label="Loading factories" />;
  if ((factories?.length ?? 0) === 0 && pathname !== '/onboarding') return <Navigate to="/onboarding" replace />;

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
