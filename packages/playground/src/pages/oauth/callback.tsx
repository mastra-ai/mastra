/**
 * OAuth Callback Page
 *
 * Handles the OAuth redirect from service provider after user authorization.
 * If opened in a popup, notifies the opener and closes.
 * If opened as redirect, stores code and redirects back.
 */

import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { storeOAuthCode, clearPendingOAuthServer } from '@mastra/playground-ui';

export function OAuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  useEffect(() => {
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    // Check if we're in a popup
    const isPopup = window.opener && window.opener !== window;

    if (error) {
      setStatus('error');
      setErrorMessage(errorDescription || error);

      if (isPopup) {
        // Notify opener of error and close popup
        try {
          window.opener.postMessage({ type: 'oauth_error', error: errorDescription || error }, window.location.origin);
        } catch {
          // Opener might be closed
        }
        setTimeout(() => {
          clearPendingOAuthServer();
          window.close();
        }, 2000);
      } else {
        // Redirect back to tools page after a delay
        setTimeout(() => {
          clearPendingOAuthServer();
          navigate('/tools');
        }, 3000);
      }
      return;
    }

    if (code) {
      // Store the authorization code
      storeOAuthCode(code);
      setStatus('success');

      if (isPopup) {
        // Notify opener of success and close popup
        try {
          window.opener.postMessage({ type: 'oauth_success', code }, window.location.origin);
        } catch {
          // Opener might be closed
        }
        setTimeout(() => {
          window.close();
        }, 1000);
      } else {
        // Redirect back to tools page
        setTimeout(() => {
          navigate('/tools?oauth=complete');
        }, 1000);
      }
    } else {
      setStatus('error');
      setErrorMessage('No authorization code received');

      if (isPopup) {
        try {
          window.opener.postMessage(
            { type: 'oauth_error', error: 'No authorization code received' },
            window.location.origin,
          );
        } catch {
          // Opener might be closed
        }
        setTimeout(() => {
          clearPendingOAuthServer();
          window.close();
        }, 2000);
      } else {
        setTimeout(() => {
          clearPendingOAuthServer();
          navigate('/tools');
        }, 3000);
      }
    }
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface1">
      <div className="bg-surface2 border border-border1 rounded-lg p-8 max-w-md w-full text-center">
        {status === 'processing' && (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent1 mx-auto mb-4" />
            <h1 className="text-xl font-semibold text-icon6 mb-2">Completing Authentication</h1>
            <p className="text-icon3">Please wait...</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="h-12 w-12 rounded-full bg-accent1/20 flex items-center justify-center mx-auto mb-4">
              <svg className="h-6 w-6 text-accent1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-icon6 mb-2">Authentication Successful</h1>
            <p className="text-icon3">Redirecting you back...</p>
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
            <p className="text-icon3">Redirecting you back...</p>
          </>
        )}
      </div>
    </div>
  );
}

export default OAuthCallback;
