/**
 * Shared types for WorkOS integration.
 */

import type { JwtPayload } from '@mastra/auth';
import type { EEUser, MastraFGAPermission, RoleMapping } from '@mastra/core/auth/ee';
import type { RequestContext } from '@mastra/core/di';
import type { User, OrganizationMembership } from '@workos-inc/node';

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
  /** Pre-resolved organization membership ID (if available) */
  organizationMembershipId?: string;
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
      lastActiveAt: user.lastSignInAt,
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
 * Mapping from a verified bearer JWT payload into a WorkOSUser.
 *
 * Use this when your WorkOS JWT template includes custom claims such as
 * `organizationMembershipId`, tenant IDs, or service-account identifiers.
 */
export interface WorkOSJwtClaimsConfig {
  /** Claim path for the Mastra user ID. Defaults to `sub`. */
  userId?: string;
  /** Claim path for the WorkOS user ID. Defaults to the resolved userId. */
  workosId?: string;
  /** Claim path for the user's email. Defaults to `email`. */
  email?: string;
  /** Claim path for the user's display name. Defaults to `name`. */
  name?: string;
  /** Claim path for the organization ID. Defaults to `org_id`. */
  organizationId?: string;
  /** Claim path for the organization membership ID used by FGA. */
  organizationMembershipId?: string;
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
  /**
   * Organization ID for this Mastra deployment.
   * Used to list team members and filter by organization.
   * Defaults to WORKOS_ORGANIZATION_ID env var.
   */
  organizationId?: string;
  /** SSO configuration */
  sso?: WorkOSSSOConfig;
  /** Session configuration */
  session?: WorkOSSessionConfig;
  /** Custom provider name (default: 'workos') */
  name?: string;
  /**
   * Whether to fetch organization memberships during authentication.
   *
   * Memberships are required for FGA (Fine-Grained Authorization) checks.
   * When FGA is not configured, set this to `false` to skip the extra
   * network call to `listOrganizationMemberships` on every authenticated request.
   *
   * Defaults to `false`. Set to `true` when using `MastraFGAWorkos`.
   */
  fetchMemberships?: boolean;
  /**
   * Claim mapping for verified bearer JWTs.
   *
   * This is useful when your WorkOS JWT template includes custom claims such as
   * `organizationMembershipId`, team IDs, or service-account identity fields.
   */
  jwtClaims?: WorkOSJwtClaimsConfig;
  /**
   * When `true`, trust the verified bearer JWT claims enough to construct a
   * `WorkOSUser` even if `workos.userManagement.getUser()` does not apply.
   *
   * Use this for machine-to-machine or service-account tokens backed by a
   * WorkOS custom JWT template.
   *
   * Defaults to `false`.
   */
  trustJwtClaims?: boolean;
  /**
   * Optional escape hatch for advanced bearer-token claim mapping.
   * Runs after `jwtClaims` mapping and can override or augment the resolved user.
   */
  mapJwtPayloadToUser?: (payload: JwtPayload) => Partial<WorkOSUser> | null | undefined;
}

// ============================================================================
// RBAC Provider Options
// ============================================================================

/**
 * Cache configuration options for RBAC permission caching.
 */
export interface PermissionCacheOptions {
  /** Maximum number of users to cache (default: 1000) */
  maxSize?: number;
  /** Time-to-live in milliseconds (default: 60000) */
  ttlMs?: number;
}

/**
 * Options for MastraRBACWorkos.
 */
export interface MastraRBACWorkosOptions {
  /** WorkOS API key (defaults to WORKOS_API_KEY env var) */
  apiKey?: string;
  /** WorkOS Client ID (defaults to WORKOS_CLIENT_ID env var) */
  clientId?: string;

  /**
   * Map WorkOS organization roles to Mastra permissions.
   *
   * When provided, permissions are derived from this static mapping.
   * When omitted, permissions are fetched directly from WorkOS role
   * definitions (permissions in WorkOS must match Mastra's resource:action pattern).
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
  roleMapping?: RoleMapping;

  /**
   * Organization ID to check roles for.
   * If not provided, uses the first organization the user belongs to.
   */
  organizationId?: string;

  /**
   * Whether multiple roles per user is enabled in your WorkOS environment.
   *
   * When true:
   * - Users can have multiple roles assigned
   * - Permissions are the union of all role permissions
   * - UI shows checkboxes for role selection
   *
   * When false (default):
   * - Users have exactly one role
   * - UI shows radio buttons for single role selection
   *
   * Configure this in WorkOS Dashboard: Authorization > Configuration > Multiple roles
   */
  multiRole?: boolean;

  /**
   * Automatically sync Mastra's generated permissions to WorkOS on startup.
   *
   * When true:
   * - On provider initialization, fetches current permissions from WorkOS
   * - Creates any missing permissions from Mastra's PERMISSIONS list
   * - Does NOT delete permissions that exist in WorkOS but not in Mastra
   *
   * When false (default):
   * - Permissions must be manually created in WorkOS Dashboard
   * - Or created via WorkOS API separately
   *
   * Note: Requires the WorkOS API key to have permission management access.
   *
   * @experimental This feature requires WorkOS Permissions API access.
   */
  syncPermissions?: boolean;

  /**
   * Automatically sync roles from roleMapping to WorkOS on startup.
   *
   * When true:
   * - Requires `syncPermissions: true` (permissions must exist first)
   * - Requires `roleMapping` to be defined (need roles to sync)
   * - On provider initialization, creates/updates roles in WorkOS
   * - Assigns permissions from roleMapping to each role
   *
   * When false (default):
   * - Roles must be manually created in WorkOS Dashboard
   *
   * Note: This only controls startup sync. Use `useWorkOSRoles` to control
   * where permissions come from at runtime.
   *
   * @experimental This feature requires WorkOS Roles API access.
   */
  syncRoles?: boolean;

  /**
   * Use WorkOS as the source of truth for role permissions at runtime.
   *
   * When true:
   * - Permissions are fetched from WorkOS role definitions
   * - Changes made in WorkOS Dashboard take effect immediately (after cache expires)
   * - roleMapping is ignored at runtime (only used if syncRoles is also true)
   *
   * When false (default):
   * - Permissions come from roleMapping configuration
   * - WorkOS is only used for role assignment, not permission definitions
   *
   * Typical configurations:
   * - `syncRoles: true, useWorkOSRoles: true` - Initial sync, then WorkOS is source of truth
   * - `syncRoles: false, useWorkOSRoles: true` - WorkOS managed externally, no sync
   * - `syncRoles: false, useWorkOSRoles: false` - Static roleMapping only (default)
   */
  useWorkOSRoles?: boolean;

  /** Permission cache configuration */
  cache?: PermissionCacheOptions;
}

// ============================================================================
// FGA Types
// ============================================================================

/**
 * Configuration for mapping Mastra resource types to FGA resource types.
 *
 * @example
 * ```typescript
 * {
 *   agent: { fgaResourceType: 'team', deriveId: (ctx) => ctx.user.teamId },
 *   workflow: { fgaResourceType: 'team', deriveId: (ctx) => ctx.user.teamId },
 *   thread: { fgaResourceType: 'workspace-thread', deriveId: ({ resourceId }) => resourceId },
 * }
 * ```
 */
export interface FGAResourceMappingEntry {
  /** The FGA resource type slug in WorkOS */
  fgaResourceType: string;
  /**
   * Parent FGA resource type slug used for batched WorkOS resource discovery.
   *
   * Set this when `deriveId` returns a parent resource ID without a concrete
   * child resource ID. For example, an agent mapping with
   * `fgaResourceType: 'team-agent'` can use `parentFgaResourceType: 'team'`.
   */
  parentFgaResourceType?: string;
  /** Alias for parentFgaResourceType. */
  parentResourceTypeSlug?: string;
  /**
   * Derive the FGA resource ID from request/user context.
   * Return `undefined` to fall back to the raw Mastra resource ID.
   */
  deriveId?: (ctx: { user: any; resourceId?: string; requestContext?: RequestContext }) => string | undefined;
}

export type MastraFGAPermissionMapping = Partial<Record<MastraFGAPermission, string>> & Record<string, string>;

/**
 * Options for MastraFGAWorkos provider.
 *
 * @example
 * ```typescript
 * import { MastraFGAPermissions } from '@mastra/core/auth/ee';
 *
 * new MastraFGAWorkos({
 *   resourceMapping: {
 *     agent: { fgaResourceType: 'team', deriveId: (ctx) => ctx.user.teamId },
 *   },
 *   permissionMapping: {
 *     [MastraFGAPermissions.AGENTS_EXECUTE]: 'manage-workflows',
 *   },
 * });
 * ```
 */
export interface MastraFGAWorkosOptions {
  /** WorkOS API key (defaults to WORKOS_API_KEY env var) */
  apiKey?: string;
  /** WorkOS Client ID (defaults to WORKOS_CLIENT_ID env var) */
  clientId?: string;
  /**
   * Organization ID to scope FGA checks to.
   * When a user has multiple organization memberships, this determines
   * which membership to use for authorization checks.
   * If not provided, uses the first membership found on the user object.
   */
  organizationId?: string;
  /**
   * Map Mastra resource types to WorkOS FGA resource types.
   * Keys are Mastra resource types (e.g., 'agent', 'workflow', 'thread').
   * Legacy aliases such as 'agents', 'workflows', and 'memory' are also accepted.
   */
  resourceMapping?: Record<string, FGAResourceMappingEntry>;
  /**
   * Map Mastra permission strings to WorkOS permission slugs.
   * Keys are Mastra permissions such as MastraFGAPermissions.AGENTS_EXECUTE,
   * values are WorkOS permission slugs.
   */
  permissionMapping?: MastraFGAPermissionMapping;
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
