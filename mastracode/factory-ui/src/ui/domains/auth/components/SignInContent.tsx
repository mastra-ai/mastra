import { BrandLoader } from '@mastra/playground-ui/components/BrandLoader';
import { Button } from '@mastra/playground-ui/components/Button';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Navigate, useSearchParams } from 'react-router';

import { useFactoryAuth } from '../../../../hooks/useFactoryAuth';
import { isCustomDomainSignInBlocked, safeReturnTo } from '../services/sign-in';
import { CustomDomainAuthError } from './CustomDomainAuthError';
import { SignInErrorNotice } from './SignInErrorNotice';
import { SignInMethod } from './SignInMethod';

export function SignInContent() {
  const auth = useFactoryAuth({ monitorSession: true });
  const [searchParams] = useSearchParams();
  const returnTo = safeReturnTo(searchParams.get('returnTo') ?? undefined);
  const authError = searchParams.get('error') ?? undefined;
  const authErrorDescription = searchParams.get('error_description') ?? undefined;

  // A cached signed-in result may predate the redirect here. Check the cookie
  // again before sending the user back into the protected app.
  if (auth.isPending || !auth.isFetchedAfterMount) {
    return <BrandLoader size="lg" aria-label="Checking sign-in" />;
  }

  if (auth.isError) {
    return (
      <div role="alert" className="space-y-3">
        <Txt as="p" variant="body" tone="muted">
          Unable to check your sign-in status. Check your connection and try again.
        </Txt>
        <Button onClick={() => void auth.refetch()} disabled={auth.isFetching}>
          Try again
        </Button>
      </div>
    );
  }

  if (!auth.data.authEnabled || auth.data.authenticated) {
    if (auth.isFetching) return <BrandLoader size="lg" aria-label="Checking sign-in" />;
    return <Navigate to={returnTo} replace />;
  }

  if (isCustomDomainSignInBlocked(auth.data, window.location.hostname, authError)) {
    return <CustomDomainAuthError hostname={window.location.hostname} />;
  }

  return (
    <>
      {authError && <SignInErrorNotice error={authError} description={authErrorDescription} />}
      <SignInMethod
        provider={auth.data.provider}
        signUpDisabled={auth.data.signUpDisabled === true}
        returnTo={returnTo}
      />
    </>
  );
}
