/**
 * Mastra Cloud auth provider - OAuth SSO with PKCE.
 * Requires MASTRA_PROJECT_ID, MASTRA_CLOUD_URL, and MASTRA_CALLBACK_URL environment variables.
 */

import type { AuthResult } from './types';

export async function initCloud(): Promise<AuthResult> {
  const { MastraCloudAuthProvider, MastraRBACCloud } = await import('@mastra/auth-cloud');

  const mastraAuth = new MastraCloudAuthProvider({
    projectId: process.env.MASTRA_PROJECT_ID!,
    cloudBaseUrl: process.env.MASTRA_CLOUD_URL!,
    callbackUrl: process.env.MASTRA_CALLBACK_URL!,
  });

  const rbacProvider = new MastraRBACCloud({
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

  console.log('[Auth] Using Mastra Cloud authentication');
  return { mastraAuth, rbacProvider };
}
