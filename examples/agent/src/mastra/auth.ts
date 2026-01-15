/**
 * Auth configuration for the example agent.
 *
 * This sets up:
 * - Better Auth for authentication (WHO the user is)
 * - StaticRBACProvider for authorization (WHAT the user can do)
 *
 * The separation allows mixing different providers:
 * - Use Better Auth for credentials-based authentication
 * - Use StaticRBACProvider with role mapping for RBAC
 */

import { MastraAuthBetterAuth } from '@mastra/auth-better-auth';
import { StaticRBACProvider, DEFAULT_ROLES } from '@mastra/core/ee';
import type { EEUser } from '@mastra/core/ee';
import { betterAuth } from 'better-auth';
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';

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
export const mastraAuth = new MastraAuthBetterAuth({
  auth,
});

/**
 * RBAC provider using StaticRBACProvider.
 *
 * Handles authorization (WHAT the user can do).
 * Uses Mastra's default roles: owner, admin, member, viewer.
 *
 * In this example, we assign roles based on user email:
 * - Admin emails get 'admin' role
 * - Everyone else gets 'member' role
 */
export const rbacProvider = new StaticRBACProvider<EEUser>({
  roles: DEFAULT_ROLES,
  getUserRoles: (user: EEUser) => {
    // Example role assignment logic - customize as needed
    // In a real app, you might store roles in a database
    const adminEmails = ['admin@example.com', 'owner@example.com'];

    if (user.email && adminEmails.includes(user.email)) {
      return ['admin'];
    }

    // Give all users admin role for demo purposes (includes audit:read)
    return ['admin'];
  },
});

/**
 * Alternative: RBAC provider using role mapping.
 *
 * Use this approach when your identity provider (WorkOS, Okta, Azure AD)
 * has its own roles that need to be translated to Mastra permissions.
 *
 * Example:
 * ```typescript
 * export const rbacProviderWithMapping = new StaticRBACProvider<EEUser>({
 *   roleMapping: {
 *     "Engineering": ["agents:*", "workflows:*", "tools:*"],
 *     "Product": ["agents:read", "workflows:read", "logs:read"],
 *     "Support": ["agents:execute", "logs:read"],
 *     "Admin": ["*"],
 *     "_default": ["agents:read"],  // Fallback for unmapped roles
 *   },
 *   getUserRoles: (user: EEUser) => {
 *     // Get roles from your identity provider
 *     // In a real app, these would come from the user's metadata
 *     return (user.metadata?.providerRoles as string[]) || [];
 *   },
 * });
 * ```
 */
