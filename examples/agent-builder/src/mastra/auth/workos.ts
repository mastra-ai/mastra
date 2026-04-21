/**
 * WorkOS provider — enterprise SSO (SAML, OIDC). Requires
 * `WORKOS_API_KEY` and `WORKOS_CLIENT_ID` environment variables.
 *
 * The Agent Builder relies on per-user preferences (starred agents and
 * skills, preview mode) which require `user:write`. We add it to the
 * `member` role below so non-admin users can star things.
 */

import type { AuthResult } from './types';

export async function initWorkOS(): Promise<AuthResult> {
  const { MastraAuthWorkos, MastraRBACWorkos } = await import('@mastra/auth-workos');

  const mastraAuth = new MastraAuthWorkos({
    redirectUri: process.env.WORKOS_REDIRECT_URI || 'http://localhost:4111/api/auth/callback',
  });

  const rbacProvider = new MastraRBACWorkos({
    cache: { ttlMs: 1 },
    roleMapping: {
      admin: ['*'],
      member: ['*:read', '*:execute', 'user:write', 'stored-agents:write', 'stored:write'],
      viewer: ['*:read'],
      _default: [],
    },
  });

  console.log('[Auth] Using WorkOS authentication');
  return { mastraAuth, rbacProvider };
}
