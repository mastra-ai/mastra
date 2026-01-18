import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

/**
 * OAuth Callback Page
 *
 * This page is shown briefly when the user is redirected back from an OAuth provider
 * during SSO authentication. The actual OAuth callback is handled server-side at
 * /api/auth/sso/callback, which exchanges the authorization code for a session
 * and redirects the user to their intended destination with session cookies set.
 *
 * This component exists to:
 * 1. Show a loading state while the server processes the callback
 * 2. Handle any errors passed via query parameters
 * 3. Provide a fallback redirect if server redirect fails
 */
export function OAuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'processing' | 'error'>('processing');
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  useEffect(() => {
    // Check for error in query parameters (from failed OAuth flow)
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    if (error) {
      setStatus('error');
      setErrorMessage(errorDescription || error);

      // Redirect back to login page after a delay
      setTimeout(() => {
        navigate('/login?error=' + encodeURIComponent(errorDescription || error), { replace: true });
      }, 3000);
      return;
    }

    // If we reach this page with code, the server will handle the OAuth callback
    // at /api/auth/sso/callback and redirect. If we're still here after a few seconds,
    // something went wrong, so redirect to login.
    const code = searchParams.get('code');
    if (code) {
      // Wait for server redirect; if it doesn't happen, redirect manually
      const timeout = setTimeout(() => {
        const redirectTo = searchParams.get('state')?.split('|')[1] || '/';
        navigate(redirectTo, { replace: true });
      }, 5000);

      return () => clearTimeout(timeout);
    } else {
      // No code and no error - unexpected state
      setStatus('error');
      setErrorMessage('Invalid OAuth callback state');
      setTimeout(() => {
        navigate('/login', { replace: true });
      }, 3000);
    }
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface1">
      <div className="bg-surface2 border border-border1 rounded-lg p-8 max-w-md w-full text-center">
        {status === 'processing' && (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent1 mx-auto mb-4" />
            <h1 className="text-xl font-semibold text-icon6 mb-2">Completing Authentication</h1>
            <p className="text-icon3">Please wait while we sign you in...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="h-12 w-12 rounded-full bg-destructive1/20 flex items-center justify-center mx-auto mb-4">
              <svg className="h-6 w-6 text-destructive1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-icon6 mb-2">Authentication Failed</h1>
            <p className="text-destructive1 mb-2">{errorMessage}</p>
            <p className="text-icon3">Redirecting you to login...</p>
          </>
        )}
      </div>
    </div>
  );
}

export default OAuthCallback;
