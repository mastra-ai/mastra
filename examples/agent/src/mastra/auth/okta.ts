/**
 * Full Okta provider - Okta for both authentication and RBAC.
 *
 * This uses Okta for:
 * - Authentication: JWT verification via Okta JWKS
 * - RBAC: Mapping Okta groups to Mastra permissions
 *
 * Requires environment variables:
 * - OKTA_DOMAIN: Okta domain (e.g., 'dev-123456.okta.com')
 * - OKTA_CLIENT_ID: OAuth client ID from your Okta application
 * - OKTA_CLIENT_SECRET: OAuth client secret from your Okta application
 * - OKTA_REDIRECT_URI: OAuth redirect URI (e.g., 'http://localhost:4114/api/auth/sso/callback')
 * - OKTA_API_TOKEN: API token for fetching user groups (Security → API → Tokens)
 *
 * Optional:
 * - OKTA_ISSUER: Custom issuer URL (defaults to https://{domain}/oauth2/default)
 * - OKTA_COOKIE_PASSWORD: Session encryption key (min 32 chars; auto-generated if omitted)
 */

import type { AuthResult } from './types';

export async function initOkta(): Promise<AuthResult> {
  const { MastraAuthOkta, MastraRBACOkta } = await import('@mastra/auth-okta');

  // Okta handles authentication (JWT verification)
  const mastraAuth = new MastraAuthOkta({
    domain: process.env.OKTA_DOMAIN,
    clientId: process.env.OKTA_CLIENT_ID,
    // Optional: custom issuer for custom authorization servers
    // issuer: process.env.OKTA_ISSUER,
  });

  // Okta handles RBAC (mapping groups to permissions)
  const rbacProvider = new MastraRBACOkta({
    domain: process.env.OKTA_DOMAIN,
    apiToken: process.env.OKTA_API_TOKEN,

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

      // Default for users with no matching groups - no permissions
      _default: [],
    },

    // Cache group lookups for 5 minutes to reduce Okta API calls
    cache: {
      maxSize: 1000,
      ttlMs: 5 * 60 * 1000,
    },
  });

  console.log('[Auth] Using Okta for authentication and RBAC');
  return { mastraAuth, rbacProvider };
}
