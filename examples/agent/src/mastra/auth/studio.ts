/**
 * Mastra Studio auth provider - proxies authentication through shared API.
 * Requires MASTRA_SHARED_API_URL environment variable.
 * Optionally accepts MASTRA_ORGANIZATION_ID for org-scoped access.
 */

import type { AuthResult } from './types';

export async function initStudio(): Promise<AuthResult> {
  const { MastraAuthStudio, MastraRBACStudio } = await import('@mastra/auth-studio');

  const mastraAuth = new MastraAuthStudio({
    sharedApiUrl: process.env.MASTRA_SHARED_API_URL!,
    organizationId: process.env.MASTRA_ORGANIZATION_ID,
  });

  const rbacProvider = new MastraRBACStudio({
    roleMapping: {
      // Full access
      owner: ['*'],
      // Full access
      admin: ['*:read', '*:write', '*:execute'],
      // API access
      api: ['*:read', '*:write', '*:execute'],
      // Read and execute across all resources
      member: ['*:read', '*:execute'],
      // Read-only access to all resources
      viewer: ['*:read'],
      // Minimal default - no access
      _default: [],
    },
  });

  console.log('[Auth] Using Mastra Studio authentication');
  return { mastraAuth, rbacProvider };
}
