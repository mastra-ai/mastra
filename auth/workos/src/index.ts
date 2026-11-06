/**
 * @mastra/auth-workos
 *
 * Full WorkOS integration for Mastra, providing:
 * - Enterprise SSO (SAML, OIDC) via AuthKit
 * - User management with organization roles
 * - Directory Sync (SCIM) for automated user provisioning
 * - Audit log export to WorkOS for SIEM integration
 * - Admin Portal for customer self-service configuration
 *
 * @example Basic setup with SSO and RBAC
 * ```typescript
 * import { MastraAuthWorkos } from '@mastra/auth-workos';
 * import { MastraRBACWorkos } from '@mastra/auth-workos/ee';
 *
 * const mastra = new Mastra({
 *   server: {
 *     auth: new MastraAuthWorkos({
 *       apiKey: process.env.WORKOS_API_KEY,
 *       clientId: process.env.WORKOS_CLIENT_ID,
 *     }),
 *     rbac: new MastraRBACWorkos({
 *       apiKey: process.env.WORKOS_API_KEY,
 *       clientId: process.env.WORKOS_CLIENT_ID,
 *       roleMapping: {
 *         'admin': ['*'],
 *         'member': ['agents:read', 'workflows:*'],
 *         '_default': [],
 *       },
 *     }),
 *   },
 * });
 * ```
 *
 * @see https://workos.com/docs for WorkOS documentation
 */

// Main auth provider
export { MastraAuthWorkos } from './auth-provider';

// RBAC and FGA providers now live in `@mastra/auth-workos/ee`. These aliases keep old imports working.
import { MastraFGAWorkos as EEMastraFGAWorkos } from './fga-provider';
import { MastraRBACWorkos as EEMastraRBACWorkos } from './rbac-provider';

/**
 * @deprecated Import `MastraRBACWorkos` from `@mastra/auth-workos/ee` instead.
 * RBAC requires a Mastra Enterprise Edition license in production.
 */
export const MastraRBACWorkos = EEMastraRBACWorkos;
/** @deprecated Import `MastraRBACWorkos` from `@mastra/auth-workos/ee` instead. */
export type MastraRBACWorkos = EEMastraRBACWorkos;

/**
 * @deprecated Import `MastraFGAWorkos` from `@mastra/auth-workos/ee` instead.
 * FGA requires a Mastra Enterprise Edition license in production.
 */
export const MastraFGAWorkos = EEMastraFGAWorkos;
/** @deprecated Import `MastraFGAWorkos` from `@mastra/auth-workos/ee` instead. */
export type MastraFGAWorkos = EEMastraFGAWorkos;

export { WorkOSFGAMembershipResolutionError, WorkOSFGAResourceNotFoundError } from './fga-provider';

// Directory Sync (SCIM) webhook handler
export { WorkOSDirectorySync } from './directory-sync';

// Admin Portal helper
export { WorkOSAdminPortal } from './admin-portal';

// Session storage adapter for Web Request/Response
export { WebSessionStorage } from './session-storage';

// Re-export all types
export type {
  // User types
  WorkOSUser,

  // Auth provider options
  MastraAuthWorkosOptions,
  WorkOSSSOConfig,
  WorkOSSessionConfig,
  WorkOSJwtClaimsConfig,

  // RBAC options
  MastraRBACWorkosOptions,
  PermissionCacheOptions,

  // FGA options
  MastraFGAWorkosOptions,
  MastraFGAPermissionMapping,

  // Directory Sync types
  DirectorySyncHandlers,
  DirectorySyncUserData,
  DirectorySyncGroupData,
  WorkOSDirectorySyncOptions,

  // Admin Portal types
  AdminPortalIntent,
  WorkOSAdminPortalOptions,
} from './types';

// Re-export helper function
export { mapWorkOSUserToEEUser } from './types';
