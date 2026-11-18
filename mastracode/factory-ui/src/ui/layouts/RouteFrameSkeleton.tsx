import { useLocation } from 'react-router';

import { SignInSkeleton } from '../domains/auth/components/SignInSkeleton';
import { FactoryOnboardingSkeleton } from '../domains/workspaces/components/FactoryOnboardingSkeleton';
import { AppLayoutSkeleton } from './AppLayoutSkeleton';

export function RouteFrameSkeleton({ label }: { label: string }) {
  const { pathname } = useLocation();
  if (pathname === '/signin') return <SignInSkeleton label={label} />;
  if (pathname === '/onboarding') return <FactoryOnboardingSkeleton label={label} />;
  return <AppLayoutSkeleton label={label} />;
}
