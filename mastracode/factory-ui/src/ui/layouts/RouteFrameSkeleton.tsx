import { useLocation } from 'react-router';

import { FactoryOnboardingSkeleton } from '../domains/workspaces/components/FactoryOnboardingSkeleton';
import { AppLayoutSkeleton } from './AppLayoutSkeleton';

export function RouteFrameSkeleton({ label }: { label: string }) {
  const { pathname } = useLocation();
  if (pathname === '/onboarding') return <FactoryOnboardingSkeleton label={label} />;
  return <AppLayoutSkeleton label={label} />;
}
