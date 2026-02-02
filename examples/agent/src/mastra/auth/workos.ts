/**
 * WorkOS provider - Enterprise SSO support (SAML, OIDC).
 * Requires WORKOS_API_KEY and WORKOS_CLIENT_ID environment variables.
 */

import type { AuthResult } from './types';

export async function initWorkOS(): Promise<AuthResult> {
  const { MastraAuthWorkos, MastraRBACWorkos } = await import('@mastra/auth-workos');

  const mastraAuth = new MastraAuthWorkos();

  const rbacProvider = new MastraRBACWorkos({
    roleMapping: {
      admin: ['*'],
      member: ['agents:read', 'agents:execute', 'workflows:read', 'workflows:execute', 'logs:read'],
      viewer: ['agents:read', 'workflows:read', 'logs:read'],
      _default: ['agents:read'],
    },
  });

  console.log('[Auth] Using WorkOS authentication');
  return { mastraAuth, rbacProvider };
}
