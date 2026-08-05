/**
 * Auth0 provider - Auth0 for authentication with SSO Studio login.
 *
 * Requires environment variables:
 * - AUTH0_DOMAIN: Auth0 domain (e.g., 'dev-xxx.us.auth0.com')
 * - AUTH0_AUDIENCE: Auth0 API audience
 * - AUTH0_CLIENT_ID: Auth0 application Client ID
 * - AUTH0_CLIENT_SECRET: Auth0 application Client Secret
 * - AUTH0_COOKIE_PASSWORD: Min 32 chars for session cookie encryption
 */

import type { MastraAuthProvider } from '@mastra/core/server';
import type { AuthResult } from './types';

export async function initAuth0(): Promise<AuthResult> {
  const { MastraAuthAuth0 } = await import('@mastra/auth-auth0');

  const mastraAuth = new MastraAuthAuth0({
    domain: process.env.AUTH0_DOMAIN,
    audience: process.env.AUTH0_AUDIENCE,
    clientId: process.env.AUTH0_CLIENT_ID,
    clientSecret: process.env.AUTH0_CLIENT_SECRET,
    session: {
      cookiePassword: process.env.AUTH0_COOKIE_PASSWORD,
    },
  });

  console.log('[Auth] Using Auth0 with SSO Studio login');

  return {
    mastraAuth: mastraAuth as unknown as MastraAuthProvider<{ id: string }>,
  };
}
