/**
 * Dual Auth provider - WorkOS for Studio (internal team), Simple token auth for API.
 *
 * This demonstrates the dual auth pattern where:
 * - Studio (internal team) uses WorkOS SSO
 * - API (external customers) uses simple token auth
 *
 * Requires WORKOS_API_KEY, WORKOS_CLIENT_ID, and WORKOS_ORGANIZATION_ID
 * environment variables for Studio auth.
 */

import type { AuthResult } from './types';

export async function initDualWorkOS(): Promise<AuthResult> {
  const { MastraAuthWorkos, MastraRBACWorkos, MastraFGAWorkos } = await import('@mastra/auth-workos');
  const { SimpleAuth } = await import('@mastra/core/server');
  const { StaticRBACProvider, DEFAULT_ROLES } = await import('@mastra/core/auth/ee');

  // Studio auth - WorkOS SSO for internal team members
  const studioAuth = new MastraAuthWorkos({
    redirectUri: process.env.WORKOS_REDIRECT_URI || 'http://localhost:4111/api/auth/sso/callback',
    fetchMemberships: true,
  });

  const studioRbac = new MastraRBACWorkos({
    cache: { ttlMs: 1 },
    roleMapping: {
      admin: ['*'],
      member: ['*:read', '*:execute'],
      viewer: ['*:read'],
      _default: [],
    },
  });

  const studioFga = new MastraFGAWorkos({
    organizationId: process.env.WORKOS_ORGANIZATION_ID,
    resourceMapping: {
      agent: { fgaResourceType: 'agent' },
      workflow: { fgaResourceType: 'workflow' },
      tool: { fgaResourceType: 'tool' },
      memory: { fgaResourceType: 'user', deriveId: ctx => ctx.user.userId },
    },
    permissionMapping: {},
  });

  // Server auth - Simple token auth for external API customers
  const serverAuth = new SimpleAuth({
    tokens: {
      'customer-token-123': {
        id: 'customer-1',
        email: 'customer@example.com',
        name: 'External Customer',
      },
      'customer-token-456': {
        id: 'customer-2',
        email: 'partner@example.com',
        name: 'Partner API',
      },
    },
  });

  const serverRbac = new StaticRBACProvider({
    roles: DEFAULT_ROLES,
    getUserRoles: () => {
      // External customers get 'member' role (read + execute)
      return ['member'];
    },
  });

  console.log('[Auth] Using dual auth: WorkOS (Studio) + SimpleAuth (API)');

  return {
    // For dual auth, we return separate configs
    // The Mastra instance will use these in server.auth vs studio.auth
    studioAuth: studioAuth as unknown as AuthResult['studioAuth'],
    studioRbac,
    studioFga,
    serverAuth: serverAuth as AuthResult['serverAuth'],
    serverRbac,
  };
}
