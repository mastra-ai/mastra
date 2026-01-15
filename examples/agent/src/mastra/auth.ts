/**
 * Auth configuration for the example agent.
 *
 * This sets up:
 * - Better Auth OR WorkOS for authentication (WHO the user is)
 * - StaticRBACProvider OR MastraRBACWorkos for authorization (WHAT the user can do)
 *
 * The separation allows mixing different providers:
 * - Use Better Auth for credentials-based authentication
 * - Use WorkOS for enterprise SSO (SAML, OIDC)
 * - Use StaticRBACProvider with role mapping for RBAC
 *
 * Set AUTH_PROVIDER=workos in .env to use WorkOS instead of Better Auth.
 */

import { MastraAuthBetterAuth } from '@mastra/auth-better-auth';
import { MastraAuthWorkos, MastraRBACWorkos } from '@mastra/auth-workos';
import { StaticRBACProvider, DEFAULT_ROLES } from '@mastra/core/ee';
import type { EEUser } from '@mastra/core/ee';
import { betterAuth } from 'better-auth';
import { WorkOS } from '@workos-inc/node';
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';

// ===========================================================================
// Auth Provider Selection
// ===========================================================================

const AUTH_PROVIDER = process.env.AUTH_PROVIDER || 'better-auth'; // 'better-auth' | 'workos'

// ===========================================================================
// Better Auth Configuration (default)
// ===========================================================================

// Use absolute path to ensure database is found regardless of working directory
const dbPath = join(import.meta.dirname, '../../database.sqlite');

export const auth = betterAuth({
  database: new DatabaseSync(dbPath),
  emailAndPassword: {
    enabled: true,
  },
});

/**
 * Mastra auth provider using Better Auth.
 *
 * Handles authentication (WHO the user is).
 * Implements IUserProvider for EE user awareness in Studio.
 */
const betterAuthProvider = new MastraAuthBetterAuth({
  auth,
});

/**
 * RBAC provider using StaticRBACProvider.
 *
 * Handles authorization (WHAT the user can do).
 * Uses Mastra's default roles: owner, admin, member, viewer.
 */
const staticRbacProvider = new StaticRBACProvider<EEUser>({
  roles: DEFAULT_ROLES,
  getUserRoles: (user: EEUser) => {
    const adminEmails = ['admin@example.com', 'owner@example.com'];
    if (user.email && adminEmails.includes(user.email)) {
      return ['admin'];
    }
    // Give all users admin role for demo purposes (includes audit:read)
    return ['admin'];
  },
});

// ===========================================================================
// WorkOS Configuration (enterprise SSO)
// ===========================================================================

/**
 * Initialize WorkOS client if credentials are available.
 *
 * Required environment variables:
 * - WORKOS_API_KEY: Your WorkOS API key
 * - WORKOS_CLIENT_ID: Your WorkOS client ID
 *
 * Optional:
 * - WORKOS_REDIRECT_URI: OAuth redirect URI (default: http://localhost:4111/api/auth/callback)
 */
const workosClient =
  process.env.WORKOS_API_KEY && process.env.WORKOS_CLIENT_ID
    ? new WorkOS(process.env.WORKOS_API_KEY, { clientId: process.env.WORKOS_CLIENT_ID })
    : null;

/**
 * Mastra auth provider using WorkOS.
 *
 * Handles authentication via WorkOS AuthKit with SSO support.
 * Implements IUserProvider, ISSOProvider, ISessionProvider for full EE features.
 */
const workosAuthProvider = workosClient
  ? new MastraAuthWorkos({
      apiKey: process.env.WORKOS_API_KEY,
      clientId: process.env.WORKOS_CLIENT_ID,
      redirectUri: process.env.WORKOS_REDIRECT_URI || 'http://localhost:4111/api/auth/callback',
      sso: {
        // Configure SSO connection selection strategy
        // 'auto' - Automatically detect based on email domain
        // 'prompt' - Always show organization selector
        connectionSelectStrategy: 'auto',
      },
    })
  : null;

/**
 * RBAC provider using WorkOS organization roles.
 *
 * Maps WorkOS organization roles to Mastra permissions:
 * - admin -> full access
 * - member -> read + execute
 * - viewer -> read only
 */
const workosRbacProvider = workosClient
  ? new MastraRBACWorkos({
      workos: workosClient,
      roleMapping: {
        admin: ['*'],
        member: ['agents:read', 'agents:execute', 'workflows:read', 'workflows:execute', 'logs:read', 'audit:read'],
        viewer: ['agents:read', 'workflows:read', 'logs:read'],
        _default: ['agents:read'], // Fallback for unmapped roles
      },
    })
  : null;

// ===========================================================================
// Exported Providers (based on AUTH_PROVIDER env var)
// ===========================================================================

/**
 * The active auth provider.
 *
 * - AUTH_PROVIDER=better-auth (default): Uses Better Auth with credentials
 * - AUTH_PROVIDER=workos: Uses WorkOS with SSO
 */
export const mastraAuth = AUTH_PROVIDER === 'workos' && workosAuthProvider ? workosAuthProvider : betterAuthProvider;

/**
 * The active RBAC provider.
 *
 * - AUTH_PROVIDER=better-auth (default): Uses StaticRBACProvider
 * - AUTH_PROVIDER=workos: Uses MastraRBACWorkos
 */
export const rbacProvider = AUTH_PROVIDER === 'workos' && workosRbacProvider ? workosRbacProvider : staticRbacProvider;

// Log which provider is being used
if (AUTH_PROVIDER === 'workos') {
  if (workosAuthProvider) {
    console.log('[Auth] Using WorkOS authentication');
  } else {
    console.warn(
      '[Auth] AUTH_PROVIDER=workos but WORKOS_API_KEY/WORKOS_CLIENT_ID not set, falling back to Better Auth',
    );
  }
} else {
  console.log('[Auth] Using Better Auth authentication');
}
