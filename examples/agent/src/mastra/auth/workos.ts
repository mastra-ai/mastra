/**
 * WorkOS provider - Enterprise SSO support (SAML, OIDC).
 * Requires WORKOS_API_KEY and WORKOS_CLIENT_ID environment variables.
 */

import type { AuthResult } from './types';
import { initSimpleAuth } from './simple';

export async function initWorkOS(): Promise<AuthResult> {
  const { MastraAuthWorkos, MastraRBACWorkos } = await import('@mastra/auth-workos');
  const { WorkOS } = await import('@workos-inc/node');

  const apiKey = process.env.WORKOS_API_KEY;
  const clientId = process.env.WORKOS_CLIENT_ID;

  if (!apiKey || !clientId) {
    console.warn('[Auth] WorkOS credentials not set, falling back to SimpleAuth');
    return initSimpleAuth();
  }

  const workosClient = new WorkOS(apiKey, { clientId });

  const mastraAuth = new MastraAuthWorkos({
    apiKey,
    clientId,
    redirectUri: process.env.WORKOS_REDIRECT_URI || 'http://localhost:4111/api/auth/callback',
  });

  const rbacProvider = new MastraRBACWorkos({
    workos: workosClient,
    roleMapping: {
      admin: ['*'],
      member: ['agents:read', 'agents:execute', 'workflows:read', 'workflows:execute', 'logs:read', 'audit:read'],
      viewer: ['agents:read', 'workflows:read', 'logs:read'],
      _default: ['agents:read'],
    },
  });

  console.log('[Auth] Using WorkOS authentication');
  return { mastraAuth, rbacProvider };
}
