/**
 * Mastra Studio auth provider - OAuth SSO with PKCE.
 * Requires MASTRA_SHARED_API_URL and MASTRA_ORGANIZATION_ID environment variables.
 */

import type { AuthResult } from './types';

export async function initStudio(): Promise<AuthResult> {
  const { MastraAuthStudio, MastraRBACStudio } = await import('@mastra/auth-studio');

  const mastraAuth = new MastraAuthStudio({
    sharedApiUrl: process.env.MASTRA_SHARED_API_URL!,
    organizationId: process.env.MASTRA_ORGANIZATION_ID!,
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

  console.log('[Auth] Using the Mastra platform authentication');
  return { mastraAuth, rbacProvider };
}
