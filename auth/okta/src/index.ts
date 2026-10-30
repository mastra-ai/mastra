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
 * import { MastraRBACOkta } from '@mastra/auth-okta/ee';
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
 * import { MastraAuthOkta } from '@mastra/auth-okta';
 * import { MastraRBACOkta } from '@mastra/auth-okta/ee';
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

import { MastraRBACOkta as EEMastraRBACOkta } from './rbac-provider';

/**
 * @deprecated Import `MastraRBACOkta` from `@mastra/auth-okta/ee` instead.
 * RBAC requires a Mastra Enterprise Edition license in production.
 */
export const MastraRBACOkta = EEMastraRBACOkta;
/** @deprecated Import `MastraRBACOkta` from `@mastra/auth-okta/ee` instead. */
export type MastraRBACOkta = EEMastraRBACOkta;

// Auth provider (for complete Okta setup)
export { MastraAuthOkta } from './auth-provider';

// Types
export type { OktaUser, MastraAuthOktaOptions, MastraRBACOktaOptions, PermissionCacheOptions } from './types';

// Helper function
export { mapOktaClaimsToUser } from './types';
