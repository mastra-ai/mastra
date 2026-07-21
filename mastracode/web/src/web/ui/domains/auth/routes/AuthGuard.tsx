import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { Navigate, Outlet, useLocation } from 'react-router';

import { useWebAuth } from '../../../../../shared/hooks/useWebAuth';

export function AuthPending({ label = 'Checking sign-in' }: { label?: string }) {
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

export function AuthGuard() {
  const auth = useWebAuth();
  const location = useLocation();

  if (auth.isPending) return <AuthPending />;
  if (auth.data?.authEnabled && !auth.data.authenticated) {
    const returnTo = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={`/signin?returnTo=${encodeURIComponent(returnTo)}`} replace />;
  }
  return <Outlet />;
}
