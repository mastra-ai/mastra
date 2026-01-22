/**
 * Shared types for WorkOS integration.
 */

import type { User, OrganizationMembership } from '@workos-inc/node';
import type { EEUser, RoleMapping } from '@mastra/core/ee';

// ============================================================================
// User Types
// ============================================================================

/**
 * Extended EEUser with WorkOS-specific fields.
 */
export interface WorkOSUser extends EEUser {
  /** WorkOS user ID */
  workosId: string;
  /** Primary organization ID (if any) */
  organizationId?: string;
  /** Organization memberships with roles */
  memberships?: OrganizationMembership[];
}

/**
 * Maps a WorkOS User to EEUser format.
 */
export function mapWorkOSUserToEEUser(user: User): EEUser {
  return {
    id: user.id,
    email: user.email,
    name: user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.firstName || user.email,
    avatarUrl: user.profilePictureUrl ?? undefined,
    metadata: {
      workosId: user.id,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
    },
  };
}

// ============================================================================
// Auth Provider Options
// ============================================================================

/**
 * SSO configuration options.
 */
export interface WorkOSSSOConfig {
  /** Default organization for SSO (if not using org selector) */
  defaultOrganization?: string;
  /** Connection ID for direct SSO (bypasses org selector) */
  connection?: string;
  /** Identity provider for OAuth (e.g., 'GoogleOAuth', 'MicrosoftOAuth') */
  provider?: 'GoogleOAuth' | 'MicrosoftOAuth' | 'GitHubOAuth' | 'AppleOAuth';
}

/**
 * Session configuration options.
 */
export interface WorkOSSessionConfig {
  /** Cookie name for session storage */
  cookieName?: string;
  /**
   * Password for encrypting session cookies.
   * Must be at least 32 characters.
   * Defaults to WORKOS_COOKIE_PASSWORD env var.
   */
  cookiePassword?: string;
  /** Session duration in seconds (default: 400 days) */
  maxAge?: number;
  /** Use secure cookies (HTTPS only, default: true in production) */
  secure?: boolean;
  /** Cookie path (default: '/') */
  path?: string;
  /** SameSite attribute (default: 'Lax') */
  sameSite?: 'Strict' | 'Lax' | 'None';
}

/**
 * Options for MastraAuthWorkos.
 */
export interface MastraAuthWorkosOptions {
  /** WorkOS API key (defaults to WORKOS_API_KEY env var) */
  apiKey?: string;
  /** WorkOS Client ID (defaults to WORKOS_CLIENT_ID env var) */
  clientId?: string;
  /** OAuth redirect URI (defaults to WORKOS_REDIRECT_URI env var) */
  redirectUri?: string;
  /** SSO configuration */
  sso?: WorkOSSSOConfig;
  /** Session configuration */
  session?: WorkOSSessionConfig;
  /** Custom provider name (default: 'workos') */
  name?: string;
}

// ============================================================================
// RBAC Provider Options
// ============================================================================

/**
 * Options for MastraRBACWorkos.
 */
export interface MastraRBACWorkosOptions {
  /**
   * Map WorkOS organization roles to Mastra permissions.
   *
   * @example
   * ```typescript
   * roleMapping: {
   *   'admin': ['*'],
   *   'member': ['agents:read', 'workflows:*'],
   *   'viewer': ['agents:read', 'workflows:read'],
   *   '_default': [],
   * }
   * ```
   */
  roleMapping: RoleMapping;

  /**
   * Organization ID to check roles for.
   * If not provided, uses the first organization the user belongs to.
   */
  organizationId?: string;
}

// ============================================================================
// Directory Sync Types
// ============================================================================

/**
 * Handlers for Directory Sync webhook events.
 */
export interface DirectorySyncHandlers {
  /** Called when a user is created in the directory */
  onUserCreated?: (data: DirectorySyncUserData) => Promise<void>;
  /** Called when a user is updated in the directory */
  onUserUpdated?: (data: DirectorySyncUserData) => Promise<void>;
  /** Called when a user is deleted from the directory */
  onUserDeleted?: (data: DirectorySyncUserData) => Promise<void>;
  /** Called when a group is created */
  onGroupCreated?: (data: DirectorySyncGroupData) => Promise<void>;
  /** Called when a group is updated */
  onGroupUpdated?: (data: DirectorySyncGroupData) => Promise<void>;
  /** Called when a group is deleted */
  onGroupDeleted?: (data: DirectorySyncGroupData) => Promise<void>;
  /** Called when a user is added to a group */
  onGroupUserAdded?: (data: { group: DirectorySyncGroupData; user: DirectorySyncUserData }) => Promise<void>;
  /** Called when a user is removed from a group */
  onGroupUserRemoved?: (data: { group: DirectorySyncGroupData; user: DirectorySyncUserData }) => Promise<void>;
}

/**
 * User data from Directory Sync events.
 */
export interface DirectorySyncUserData {
  id: string;
  directoryId: string;
  organizationId?: string;
  idpId: string;
  firstName?: string;
  lastName?: string;
  jobTitle?: string;
  emails: Array<{ primary: boolean; type?: string; value: string }>;
  username?: string;
  groups: Array<{ id: string; name: string }>;
  state: 'active' | 'inactive';
  rawAttributes: Record<string, unknown>;
  customAttributes: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

/**
 * Group data from Directory Sync events.
 */
export interface DirectorySyncGroupData {
  id: string;
  directoryId: string;
  organizationId?: string;
  idpId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  rawAttributes: Record<string, unknown>;
}

/**
 * Options for WorkOSDirectorySync.
 */
export interface WorkOSDirectorySyncOptions {
  /** Webhook secret for signature verification (defaults to WORKOS_WEBHOOK_SECRET env var) */
  webhookSecret?: string;
  /** Event handlers */
  handlers: DirectorySyncHandlers;
}

// ============================================================================
// Admin Portal Types
// ============================================================================

/**
 * Admin Portal intent - what the user wants to configure.
 */
export type AdminPortalIntent = 'sso' | 'dsync' | 'audit_logs' | 'log_streams';

/**
 * Options for WorkOSAdminPortal.
 */
export interface WorkOSAdminPortalOptions {
  /** Return URL after portal configuration is complete */
  returnUrl?: string;
}
