/**
 * @mastra/auth-okta
 *
 * Okta integration for Mastra, providing:
 * - RBAC based on Okta groups (MastraRBACOkta)
 * - JWT authentication via Okta (MastraAuthOkta)
 *
 * The RBAC provider can be used with any auth provider (Auth0, Clerk, etc.)
 * to map Okta groups to Mastra permissions.
 *
 * @example Using Auth0 for auth + Okta for RBAC
 * ```typescript
 * import { MastraAuthAuth0 } from '@mastra/auth-auth0';
 * import { MastraRBACOkta } from '@mastra/auth-okta';
 *
 * const mastra = new Mastra({
 *   server: {
 *     auth: new MastraAuthAuth0(),
 *     rbac: new MastraRBACOkta({
 *       getUserId: (user) => user.metadata?.oktaUserId || user.email,
 *       roleMapping: {
 *         'Engineering': ['agents:*', 'workflows:*'],
 *         'Admin': ['*'],
 *         '_default': [],
 *       },
 *     }),
 *   },
 * });
 * ```
 *
 * @example Full Okta setup (auth + RBAC)
 * ```typescript
 * import { MastraAuthOkta, MastraRBACOkta } from '@mastra/auth-okta';
 *
 * const mastra = new Mastra({
 *   server: {
 *     auth: new MastraAuthOkta(),
 *     rbac: new MastraRBACOkta({
 *       roleMapping: {
 *         'Admin': ['*'],
 *         'Member': ['agents:read', 'workflows:*'],
 *         '_default': [],
 *       },
 *     }),
 *   },
 * });
 * ```
 */

// RBAC provider (primary export)
export { MastraRBACOkta } from './rbac-provider';

// Auth provider (for complete Okta setup)
export { MastraAuthOkta } from './auth-provider';

// Types
export type { OktaUser, MastraAuthOktaOptions, MastraRBACOktaOptions, PermissionCacheOptions } from './types';

// Helper function
export { mapOktaClaimsToUser } from './types';
