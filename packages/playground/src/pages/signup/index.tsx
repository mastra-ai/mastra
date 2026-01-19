import { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router';
import { LoginPage, useCurrentUser, useAuthCapabilities } from '@mastra/playground-ui';

/**
 * Sign Up Page
 *
 * Provides user registration via credentials (email/password).
 * Uses the same LoginPage component with initialMode set to "signup".
 * Redirects authenticated users to their intended destination.
 */
export function SignUp() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const user = useCurrentUser();
  const { data: capabilities } = useAuthCapabilities();

  const rawRedirect = searchParams.get('redirect') || '/';

  // Validate redirect URL - only allow same-origin redirects
  const getSafeRedirect = (redirect: string): string => {
    // If it starts with '/', it's a relative path - safe
    if (redirect.startsWith('/')) {
      return redirect;
    }

    // If it looks like a full URL, validate the origin
    if (redirect.startsWith('http://') || redirect.startsWith('https://')) {
      try {
        const url = new URL(redirect);
        // Only allow same-origin URLs
        if (url.origin === window.location.origin) {
          // Extract pathname + search + hash only
          return url.pathname + url.search + url.hash;
        }
      } catch {
        // Invalid URL, fall back to '/'
      }
    }

    // For any other format or cross-origin URLs, fall back to '/'
    return '/';
  };

  const redirectUri = getSafeRedirect(rawRedirect);

  // Redirect already authenticated users
  useEffect(() => {
    if (user) {
      navigate(redirectUri, { replace: true });
    }
  }, [user, redirectUri, navigate]);

  // Don't show signup page if user is already authenticated
  if (user) {
    return null;
  }

  // Check if signup is enabled
  const signUpEnabled = capabilities?.login?.signUpEnabled ?? false;

  const handleSuccess = () => {
    navigate(redirectUri, { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface1">
      {!signUpEnabled && capabilities ? (
        <div className="bg-surface2 border border-border1 rounded-lg p-8 max-w-md w-full text-center">
          <h1 className="text-xl font-semibold text-icon6 mb-2">Sign Up Disabled</h1>
          <p className="text-icon3 mb-4">
            User registration is currently disabled. Please contact an administrator for access.
          </p>
          <button
            onClick={() =>
              navigate('/login' + (redirectUri !== '/' ? `?redirect=${encodeURIComponent(redirectUri)}` : ''), {
                replace: true,
              })
            }
            className="text-accent1 hover:underline"
          >
            Go to Sign In
          </button>
        </div>
      ) : (
        <LoginPage redirectUri={redirectUri} onSuccess={handleSuccess} initialMode="signup" />
      )}
    </div>
  );
}
