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
      // Agent Builder access: CRUD agents/skills, workspace file I/O, chat history
      member: [
        // necessary
        'stored-agents:*',
        'stored-skills:*',
        //not necessary, but lose out on some features (tools in tool list and chat history)
        'tools:read',
        'workflows:read',
        'memory:read',
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
