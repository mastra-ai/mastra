/**
 * WorkOS provider - Enterprise SSO support (SAML, OIDC).
 * Requires WORKOS_API_KEY and WORKOS_CLIENT_ID environment variables.
 */

import type { AuthResult } from './types';

export async function initWorkOS(): Promise<AuthResult> {
  const { MastraAuthWorkos, MastraRBACWorkos, MastraFGAWorkos } = await import('@mastra/auth-workos');

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

  const organizationId = process.env.WORKOS_ORGANIZATION_ID;
  if (!organizationId) {
    throw new Error('WORKOS_ORGANIZATION_ID is required to enable WorkOS FGA');
  }

  const fgaProvider = new MastraFGAWorkos({
    organizationId,
    resourceMapping: {
      // Per-resource filtering: agent ID maps directly to WorkOS resource external ID
      agent: { fgaResourceType: 'agent' },
      workflow: { fgaResourceType: 'workflow' },
      tool: { fgaResourceType: 'tool' },
      // Thread access scoped to user
      memory: { fgaResourceType: 'user', deriveId: ctx => ctx.user.userId },
    },
    // Permission slugs in WorkOS match Mastra permission strings exactly
    // (e.g., 'agents:read' → 'agents:read'), so no mapping needed.
    // The provider falls through to the original permission string
    // when no mapping is found.
    permissionMapping: {},
  });

  console.log('[Auth] Using WorkOS authentication');
  return { mastraAuth, rbacProvider, fgaProvider };
}
