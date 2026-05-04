/**
 * Auth0 + Okta provider - Auth0 for authentication, Okta for RBAC.
 *
 * This demonstrates the cross-provider pattern where:
 * - Auth0 handles WHO the user is (authentication)
 * - Okta handles WHAT they can do (authorization/RBAC via groups)
 *
 * Requires environment variables:
 * - AUTH0_DOMAIN: Auth0 domain (e.g., 'your-tenant.auth0.com')
 * - AUTH0_AUDIENCE: Auth0 API audience
 * - OKTA_DOMAIN: Okta domain (e.g., 'your-org.okta.com')
 * - OKTA_API_TOKEN: Okta API token for fetching groups
 */

import type { MastraAuthProvider } from '@mastra/core/server';
import type { IRBACProvider } from '@mastra/core/auth/ee';

import type { AuthResult } from './types';

export async function initAuth0Okta(): Promise<AuthResult> {
  const { MastraAuthAuth0 } = await import('@mastra/auth-auth0');
  const { MastraRBACOkta } = await import('@mastra/auth-okta');

  // Auth0 handles authentication (verifying WHO the user is)
  const mastraAuth = new MastraAuthAuth0({
    domain: process.env.AUTH0_DOMAIN,
    audience: process.env.AUTH0_AUDIENCE,
  });

  // Okta handles RBAC (mapping groups to WHAT users can do)
  const rbacProvider = new MastraRBACOkta({
    domain: process.env.OKTA_DOMAIN,
    apiToken: process.env.OKTA_API_TOKEN,

    // Extract Okta user ID from Auth0 user
    // Option 1: Use email as the common identifier
    // Option 2: Store Okta ID in Auth0 app_metadata and use that
    getUserId: (user: unknown) => {
      const u = user as Record<string, unknown> | null | undefined;
      // If Okta ID is stored in Auth0 metadata, prefer that
      const metadata = u?.metadata as Record<string, unknown> | undefined;
      if (metadata?.oktaUserId) {
        return metadata.oktaUserId as string;
      }
      // Fall back to email (requires matching emails in both systems)
      return u?.email as string | undefined;
    },

    // Map Okta groups to Mastra permissions
    // These match the default Okta groups: Owner, Admin, Member, Viewer
    roleMapping: {
      // Owner - full access to everything
      Owner: ['*'],

      // Admin - read, write, and execute across all resources
      Admin: ['*:read', '*:write', '*:execute'],

      // Member - read and execute across all resources
      Member: ['*:read', '*:execute'],

      // Viewer - read-only access to everything
      Viewer: ['*:read'],

      // Default for users with no matching groups
      _default: [],
    },

    // Cache group lookups for 5 minutes to reduce API calls
    cache: {
      maxSize: 1000,
      ttlMs: 5 * 60 * 1000,
    },
  });

  console.log('[Auth] Using Auth0 (authentication) + Okta (RBAC)');

  // Type cast needed because Auth0 user type (JWTPayload) differs from EEUser
  // In production, you'd likely map the JWT payload to your user type
  return {
    mastraAuth: mastraAuth as unknown as MastraAuthProvider<{ id: string }>,
    rbacProvider: rbacProvider as unknown as IRBACProvider<{ id: string }>,
  };
}
