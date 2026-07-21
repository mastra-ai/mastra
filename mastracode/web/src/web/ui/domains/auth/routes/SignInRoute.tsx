import { Navigate, useSearchParams } from 'react-router';

import { useWebAuth } from '../../../../../shared/hooks/useWebAuth';
import { safeReturnTo, SignInPage } from '../components/SignInPage';
import { AuthPending } from './AuthGuard';

export function SignInRoute() {
  const auth = useWebAuth();
  const [searchParams] = useSearchParams();

  if (auth.isPending) return <AuthPending />;
  if (!auth.data?.authEnabled || auth.data.authenticated) {
    return <Navigate to={safeReturnTo(searchParams.get('returnTo') ?? undefined)} replace />;
  }
  return <SignInPage />;
}
