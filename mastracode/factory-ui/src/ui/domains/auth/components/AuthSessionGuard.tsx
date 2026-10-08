import { useState } from 'react';
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';

import { SessionExpiredDialog } from './SessionExpiredDialog';

/** Mounted after the first auth check, so expiry is distinct from a signed-out visit. */
export function AuthSessionGuard({ authenticated, children }: { authenticated: boolean; children: ReactNode }) {
  const [startedAuthenticated] = useState(authenticated);
  const location = useLocation();
  const returnTo = `${location.pathname}${location.search}${location.hash}`;

  if (!startedAuthenticated) {
    return <Navigate to={`/signin?returnTo=${encodeURIComponent(returnTo)}`} replace />;
  }

  return (
    <>
      {children}
      {!authenticated && <SessionExpiredDialog returnTo={returnTo} />}
    </>
  );
}
