/**
 * Clerk provider - JWT-based authentication via Clerk.
 *
 * Required env vars:
 *   CLERK_PUBLISHABLE_KEY      - Clerk publishable key
 *   CLERK_SECRET_KEY           - Clerk secret key
 *   CLERK_JWKS_URI             - Clerk JWKS endpoint
 *
 * Optional env vars (for Studio SSO login):
 *   CLERK_OAUTH_CLIENT_ID      - OAuth Client ID (from Clerk Dashboard → OAuth Applications)
 *   CLERK_OAUTH_CLIENT_SECRET  - OAuth Client Secret
 *   CLERK_COOKIE_PASSWORD      - Session cookie encryption password (min 32 chars)
 */

import { MastraAuthClerk } from '@mastra/auth-clerk';

import type { AuthResult } from './types';

export function initClerk(): AuthResult {
  const mastraAuth = new MastraAuthClerk({
    jwksUri: process.env.CLERK_JWKS_URI,
    secretKey: process.env.CLERK_SECRET_KEY,
    publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
    // SSO options are auto-read from env vars:
    // CLERK_OAUTH_CLIENT_ID, CLERK_OAUTH_CLIENT_SECRET, CLERK_COOKIE_PASSWORD
  });

  const ssoEnabled = mastraAuth.isSSOEnabled();
  console.log(`[Auth] Using Clerk authentication${ssoEnabled ? ' (SSO enabled)' : ' (JWT only)'}`);
  return { mastraAuth };
}
