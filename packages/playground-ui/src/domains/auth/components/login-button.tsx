import { Button } from '@/ds/components/Button/Button';

import { useSSOLogin } from '../hooks';
import type { LoginConfig, SSOConfig } from '../types';

export type LoginButtonProps = {
  config: LoginConfig;
  redirectUri?: string;
  className?: string;
  /** URL to redirect to for credentials login (defaults to /login) */
  loginUrl?: string;
};

/**
 * Login button component.
 *
 * Renders a login button based on the login configuration.
 * - For SSO: Initiates OAuth flow
 * - For credentials: Redirects to login page
 *
 * @example
 * ```tsx
 * import { LoginButton, useAuthCapabilities } from '@mastra/playground-ui';
 *
 * function LoginPage() {
 *   const { data: capabilities } = useAuthCapabilities();
 *
 *   if (!capabilities?.login) return null;
 *
 *   return (
 *     <LoginButton
 *       config={capabilities.login}
 *       redirectUri={window.location.href}
 *     />
 *   );
 * }
 * ```
 */
export function LoginButton({ config, redirectUri, className, loginUrl = '/login' }: LoginButtonProps) {
  const { mutate: login, isPending } = useSSOLogin();

  if (!config) return null;

  // For SSO login
  if (config.type === 'sso' || (config.type === 'both' && config.sso)) {
    const sso = config.sso as SSOConfig;

    const handleSSOLogin = () => {
      login(
        { redirectUri },
        {
          onSuccess: data => {
            window.location.href = data.url;
          },
        },
      );
    };

    return (
      <Button onClick={handleSSOLogin} disabled={isPending} className={className}>
        {sso?.icon && <span className="mr-2">{sso.icon}</span>}
        {sso?.text || 'Sign in with SSO'}
      </Button>
    );
  }

  // For credentials login - redirect to login page
  const handleCredentialsLogin = () => {
    const url = new URL(loginUrl, window.location.origin);
    if (redirectUri) {
      url.searchParams.set('redirect', redirectUri);
    }
    window.location.href = url.toString();
  };

  return (
    <Button onClick={handleCredentialsLogin} className={className}>
      Sign in
    </Button>
  );
}
