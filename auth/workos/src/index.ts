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
 * import { MastraAuthWorkos, MastraRBACWorkos } from '@mastra/auth-workos';
 *
 * const workosAuth = new MastraAuthWorkos({
 *   apiKey: process.env.WORKOS_API_KEY,
 *   clientId: process.env.WORKOS_CLIENT_ID,
 * });
 *
 * const mastra = new Mastra({
 *   server: {
 *     auth: workosAuth,
 *     rbac: new MastraRBACWorkos({
 *       workos: workosAuth.getWorkOS(),
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

// RBAC provider for role mapping
export { MastraRBACWorkos } from './rbac-provider';

// Directory Sync (SCIM) webhook handler
export { WorkOSDirectorySync } from './directory-sync';

// Audit provider for WorkOS Audit Logs
export { WorkOSAuditProvider } from './audit-exporter';

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

  // RBAC options
  MastraRBACWorkosOptions,

  // Directory Sync types
  DirectorySyncHandlers,
  DirectorySyncUserData,
  DirectorySyncGroupData,
  WorkOSDirectorySyncOptions,

  // Audit exporter types
  WorkOSAuditExporterOptions,

  // Admin Portal types
  AdminPortalIntent,
  WorkOSAdminPortalOptions,
} from './types';

// Re-export constants
export { DEFAULT_AUDIT_ACTION_MAPPING } from './types';

// Re-export helper function
export { mapWorkOSUserToEEUser } from './types';
