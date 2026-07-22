import { BrandLoader } from '@mastra/playground-ui/components/BrandLoader';
import { useFactoryAuth } from '../../../../../shared/hooks/useFactoryAuth';
import { useFactoriesQuery } from '../../../../../shared/hooks/useFactories';
import { Navigate, Outlet, useLocation } from 'react-router';

export const RootGuards = () => {
  return <AuthGuard />;
};

const AuthGuard = () => {
  const { isPending, isError, data } = useFactoryAuth();
  const location = useLocation();

  if (isPending) return <AuthPendingSkeleton />;
  if (isError) return <AuthPendingSkeleton label="Unable to reach MastraCode server" />;

  const state = data;
  if (!state?.authEnabled) return <AuthNotConfiguredScreen />;

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

function AuthNotConfiguredScreen() {
  return (
    <div className="grid h-dvh w-full place-items-center bg-surface1 px-6 text-center">
      <div className="max-w-md space-y-3">
        <h1 className="text-xl font-semibold text-icon6">
          This MastraCode server has no authentication provider configured
        </h1>
        <p className="text-sm leading-6 text-icon3">
          MastraCode web requires authenticated remote Factories. Configure a supported auth provider on the server,
          then reload this page.
        </p>
      </div>
    </div>
  );
}

export function AuthPendingSkeleton({ label = 'Checking sign-in' }: { label?: string }) {
  return (
    <div className="flex h-dvh w-full items-center justify-center bg-surface1">
      <BrandLoader size="lg" aria-label={label} />
    </div>
  );
}
