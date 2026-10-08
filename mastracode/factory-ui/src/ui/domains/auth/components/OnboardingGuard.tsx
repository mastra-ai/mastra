import { Navigate, Outlet, useLocation } from 'react-router';

import { useFactoriesQuery } from '../../../../hooks/useFactories';
import { FactoryWebTelemetry } from '../../telemetry/FactoryWebTelemetry';
import { hasResumableFactoryOnboarding } from '../../workspaces/services/onboardingFlow';
import { AuthPendingSkeleton } from './AuthPendingSkeleton';

export function OnboardingGuard() {
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
}
