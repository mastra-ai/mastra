/**
 * WorkOS provider - Enterprise SSO support (SAML, OIDC).
 * Requires WORKOS_API_KEY and WORKOS_CLIENT_ID environment variables.
 */

import type { AuthResult } from './types';

export async function initWorkOS(): Promise<AuthResult> {
  const { MastraAuthWorkos, MastraRBACWorkos } = await import('@mastra/auth-workos');

  const mastraAuth = new MastraAuthWorkos({
    redirectUri: process.env.WORKOS_REDIRECT_URI || 'http://localhost:4111/api/auth/callback',
  });

  const rbacProvider = new MastraRBACWorkos({
    cache: {
      ttlMs: 1,
    },
    roleMapping: {
      // Full access
      admin: ['*'],
      // Another admin-level role (should be filtered from preview list)
      superadmin: ['*'],
      // Read and execute across all resources, plus Agent Builder write access
      member: [
        '*:read',
        '*:execute',
        'agents:write',
        'stored-agents:write',
        'stored-skills:write',
        'stored-workspaces:write',
        'workspaces:write',
      ],
      // Can only view and run agents
      operator: ['agents:read', 'agents:execute', 'tools:read', 'workflows:read'],
      // Read-only access — no resources at all
      viewer: [],
      // Can only see observability
      auditor: ['observability:read', 'logs:read'],
      // Minimal default - no access
      _default: [],
    },
  });

  console.log('[Auth] Using WorkOS authentication');
  return { mastraAuth, rbacProvider };
}
