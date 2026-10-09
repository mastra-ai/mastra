import { BrandLoader } from '@mastra/playground-ui/components/BrandLoader';
import { FactoryWebTelemetry } from '../../telemetry/FactoryWebTelemetry';
import { useFactoryAuth } from '../../../../hooks/useFactoryAuth';
import { useFactoriesQuery } from '../../../../hooks/useFactories';
import { hasResumableFactoryOnboarding } from '../../workspaces/services/onboardingFlow';
import { Navigate, Outlet, ScrollRestoration, useLocation } from 'react-router';
import { Txt } from '@mastra/playground-ui/components/Txt';
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
  const { isPending, isError, data } = useFactoryAuth({ monitorSession: true });
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
  const { data: factories, isPending: factoriesPending } = useFactoriesQuery();

  if (factoriesPending) return <AuthPendingSkeleton label="Loading factories" />;
  if ((factories?.length ?? 0) === 0 && pathname !== '/onboarding') return <Navigate to="/onboarding" replace />;
  if (factories && factories.length > 0 && pathname === '/onboarding' && !hasResumableFactoryOnboarding(factories)) {
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

export function AuthPendingSkeleton({ label = 'Checking sign-in' }: { label?: string }) {
  return (
    <div className="bg-sidebar flex h-dvh w-full items-center justify-center">
      <BrandLoader size="lg" aria-label={label} />
    </div>
  );
}
