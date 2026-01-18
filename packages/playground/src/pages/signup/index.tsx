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

  const redirectUri = searchParams.get('redirect') || '/';

  // Redirect already authenticated users
  useEffect(() => {
    if (user) {
      // For full URLs, use window.location; for paths, use navigate
      if (redirectUri.startsWith('http')) {
        window.location.href = redirectUri;
      } else {
        navigate(redirectUri, { replace: true });
      }
    }
  }, [user, redirectUri, navigate]);

  // Don't show signup page if user is already authenticated
  if (user) {
    return null;
  }

  // Check if signup is enabled
  const signUpEnabled = capabilities?.login?.signUpEnabled ?? false;

  const handleSuccess = () => {
    // For full URLs, use window.location; for paths, use navigate
    if (redirectUri.startsWith('http')) {
      window.location.href = redirectUri;
    } else {
      navigate(redirectUri, { replace: true });
    }
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

export default SignUp;
