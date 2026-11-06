/**
 * @mastra/auth-google
 *
 * Google Workspace integration for Mastra, providing:
 * - Google OpenID Connect authentication with Workspace hosted-domain checks
 * - Google Groups based RBAC through the Workspace Directory API
 *
 * @example Full Google Workspace setup
 * ```typescript
 * import { MastraAuthGoogle } from '@mastra/auth-google';
 * import { MastraRBACGoogle } from '@mastra/auth-google/ee';
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

import { MastraRBACGoogle as EEMastraRBACGoogle } from './rbac-provider';

export { MastraAuthGoogle } from './auth-provider';
export { mapGoogleClaimsToUser } from './types';

/**
 * @deprecated Import `MastraRBACGoogle` from `@mastra/auth-google/ee` instead.
 * RBAC requires a Mastra Enterprise Edition license in production.
 */
export const MastraRBACGoogle = EEMastraRBACGoogle;
/** @deprecated Import `MastraRBACGoogle` from `@mastra/auth-google/ee` instead. */
export type MastraRBACGoogle = EEMastraRBACGoogle;

export type {
  GoogleSessionOptions,
  GoogleUser,
  GoogleWorkspaceGroup,
  GoogleWorkspaceServiceAccount,
  MastraAuthGoogleOptions,
  MastraRBACGoogleOptions,
  PermissionCacheOptions,
} from './types';
