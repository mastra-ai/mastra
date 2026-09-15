/**
 * @mastra/auth-google
 *
 * Google Workspace integration for Mastra, providing:
 * - Google OpenID Connect authentication with Workspace hosted-domain checks
 * - Google Groups based RBAC through the Workspace Directory API
 *
 * @example Full Google Workspace setup
 * ```typescript
 * import { MastraAuthGoogle, MastraRBACGoogle } from '@mastra/auth-google';
 *
 * const auth = new MastraAuthGoogle({
 *   allowedDomains: ['example.com'],
 * });
 *
 * const rbac = new MastraRBACGoogle({
 *   serviceAccount: {
 *     clientEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!,
 *     privateKey: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY!,
 *     subject: process.env.GOOGLE_WORKSPACE_ADMIN_EMAIL!,
 *   },
 *   roleMapping: {
 *     'admins@example.com': ['*'],
 *     'engineering@example.com': ['agents:*', 'workflows:*'],
 *     _default: [],
 *   },
 * });
 * ```
 */

export { MastraAuthGoogle } from './auth-provider';
export { MastraRBACGoogle } from './rbac-provider';
export { mapGoogleClaimsToUser } from './types';

export type {
  GoogleSessionOptions,
  GoogleUser,
  GoogleWorkspaceGroup,
  GoogleWorkspaceServiceAccount,
  MastraAuthGoogleOptions,
  MastraRBACGoogleOptions,
  PermissionCacheOptions,
} from './types';
