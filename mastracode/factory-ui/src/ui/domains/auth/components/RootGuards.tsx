import { BrandLoader } from '@mastra/playground-ui/components/BrandLoader';
import { Button } from '@mastra/playground-ui/components/Button';
import { FactoryWebTelemetry } from '../../telemetry/FactoryWebTelemetry';
import { useFactoryAuth } from '../../../../hooks/useFactoryAuth';
import { factoriesQuery, useFactoriesQuery } from '../../../../hooks/useFactories';
import { useApiConfig } from '../../../../api/config';
import { hasResumableFactoryOnboarding } from '../../workspaces/services/onboardingFlow';
import { Navigate, Outlet, ScrollRestoration, useLocation } from 'react-router';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { usePrefetchQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { SessionExpiredDialog } from './SessionExpiredDialog';

export const RootGuards = () => {
  return (
    <>
      {/* Data routers keep the window scroll across navigations without this. */}
      <ScrollRestoration />
      <AuthGuard />
    </>
  );
};

const AuthGuard = () => {
  const { baseUrl } = useApiConfig();
  const { isPending, isError, data } = useFactoryAuth({ monitorSession: true });
  // Load the Factory list alongside the sign-in check instead of after it;
  // OnboardingGuard reads the same query. The page request already passed the
  // server's auth gate, which renews an expired session cookie, so both
  // requests carry the fresh cookie. A signed-out visitor's failed list stays
  // cached as an error, which OnboardingGuard fetches again once they sign in.
  usePrefetchQuery(factoriesQuery(baseUrl));
  const location = useLocation();
  const [wasSignedIn, setWasSignedIn] = useState(false);

  if (data?.authenticated && !wasSignedIn) setWasSignedIn(true);

  if (isPending) return <AuthPendingSkeleton />;
  if (isError && !data) return <AuthPendingSkeleton label="Unable to reach MastraCode server" />;
  if (!data?.authEnabled) return <AuthNotConfiguredScreen />;

  const returnTo = `${location.pathname}${location.search}${location.hash}`;
  if (!data.authenticated && !wasSignedIn) {
    return <Navigate to={`/signin?returnTo=${encodeURIComponent(returnTo)}`} replace />;
  }

  return (
    <>
      <OnboardingGuard />
      {!data.authenticated && <SessionExpiredDialog returnTo={returnTo} />}
    </>
  );
};

const OnboardingGuard = () => {
  const pathname = useLocation().pathname;
  const { data: factories, isPending: factoriesPending, isFetching, refetch } = useFactoriesQuery();

  if (factoriesPending) return <AuthPendingSkeleton label="Loading factories" />;
  if (!factories) return <FactoriesUnavailableScreen retrying={isFetching} onRetry={() => void refetch()} />;
  if (factories.length === 0 && pathname !== '/onboarding') return <Navigate to="/onboarding" replace />;
  if (factories.length > 0 && pathname === '/onboarding' && !hasResumableFactoryOnboarding(factories)) {
    return <Navigate to={`/factories/${factories[0].id}`} replace />;
  }

  return (
    <>
      <FactoryWebTelemetry />
      <Outlet />
    </>
  );
};

function AuthNotConfiguredScreen() {
  return (
    <div className="bg-sidebar grid h-dvh w-full place-items-center px-6 text-center">
      <div className="max-w-md space-y-3">
        <Txt as="h1" variant="heading" tone="ink">
          This MastraCode server has no authentication provider configured
        </Txt>
        <Txt as="p" variant="body" tone="muted">
          MastraCode web requires authenticated remote Factories. Configure a supported auth provider on the server,
          then reload this page.
        </Txt>
      </div>
    </div>
  );
}

function FactoriesUnavailableScreen({ retrying, onRetry }: { retrying: boolean; onRetry: () => void }) {
  return (
    <div className="bg-sidebar grid h-dvh w-full place-items-center px-6 text-center">
      <div role="alert" className="max-w-md space-y-3">
        <Txt as="h1" variant="heading" tone="ink">
          Unable to load your factories
        </Txt>
        <Txt as="p" variant="body" tone="muted">
          Try again in a moment.
        </Txt>
        <Button onClick={onRetry} disabled={retrying}>
          Retry
        </Button>
      </div>
    </div>
  );
}

export function AuthPendingSkeleton({ label = 'Checking sign-in' }: { label?: string }) {
  return (
    <div className="bg-sidebar flex h-dvh w-full items-center justify-center">
      <BrandLoader size="lg" aria-label={label} />
    </div>
  );
}
