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

  // Get redirect URL from query parameter
  const redirectTo = searchParams.get('redirect') || '/';

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

export default Login;
