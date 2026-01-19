import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

import { LoginPage, useCurrentUser } from '@mastra/playground-ui';

/**
 * Login page wrapper for the playground application.
 *
 * Handles:
 * - Rendering the LoginPage component from playground-ui
 * - Preserving redirect parameter from query string
 * - Redirecting already authenticated users
 */
function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const user = useCurrentUser();

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

  const redirectTo = getSafeRedirect(rawRedirect);

  // Redirect authenticated users to their intended destination
  useEffect(() => {
    if (user) {
      navigate(redirectTo);
    }
  }, [user, redirectTo, navigate]);

  // Don't show login page if already authenticated (prevents flash)
  if (user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-neutral-2 flex items-center justify-center">
      <LoginPage redirectUri={redirectTo} />
    </div>
  );
}

export { Login };
