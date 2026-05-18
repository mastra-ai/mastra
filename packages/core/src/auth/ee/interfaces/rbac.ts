/**
 * RBAC provider interface for EE authentication.
 * Enables role-based access control in Studio.
 *
 * RBAC is designed to be separate from authentication.
 * This allows users to mix auth providers with RBAC providers:
 * - Use Better Auth for authentication + StaticRBACProvider for RBAC
 * - Use Clerk for both auth and RBAC via MastraRBACClerk
 * - Use Auth0 for auth + custom RBAC provider
 */

import type { PermissionPattern } from './permissions.generated';

// ──────────────────────────────────────────────────────────────
// RBAC Capabilities
// ──────────────────────────────────────────────────────────────

/**
 * Describes the capabilities of an RBAC provider.
 *
 * Different providers have different models:
 * - WorkOS: Single role per organization membership, roles managed in WorkOS dashboard
 * - Custom RBAC: Multiple roles per user, roles can be created dynamically
 * - Static RBAC: Roles defined in code, permissions derived from role mapping
 */
export interface RBACCapabilities {
  /**
   * Whether the provider supports multiple roles per user.
   * - true: IAM-style, users can have multiple roles assigned
   * - false: Single role per user (e.g., WorkOS org membership)
   */
  multiRole: boolean;

  /**
   * Whether roles can be created/edited/deleted at runtime.
   * - true: Roles can be managed via API (create, update, delete)
   * - false: Roles are static (defined in code or provider dashboard)
   */
  dynamicRoles: boolean;

  /**
   * Whether roles are managed by the external provider.
   * - true: Roles are fetched from provider API (WorkOS, Auth0, etc.)
   * - false: Roles are managed locally or via static config
   */
  providerManagedRoles: boolean;

  /**
   * Whether permissions can be edited for roles.
   * - true: Role permissions can be modified via API
   * - false: Permissions are derived from static role mapping
   */
  permissionEditing: boolean;

  /**
   * Whether roles can be assigned/removed via API.
   * - true: assignRole() and removeRole() are implemented
   * - false: Role assignment must be done in provider dashboard
   */
  roleAssignment: boolean;

  /**
   * Whether role inheritance is supported.
   * - true: Roles can inherit permissions from other roles
   * - false: Each role has its own standalone permissions
   */
  roleInheritance: boolean;

  /**
   * The source of role definitions.
   * - 'provider': Roles come from external provider (WorkOS, Auth0)
   * - 'config': Roles defined in roleMapping config
   * - 'storage': Roles stored in Mastra storage
   * - 'hybrid': Combination of sources
   */
  roleSource: 'provider' | 'config' | 'storage' | 'hybrid';
}

/**
 * Default capabilities for providers that don't implement getCapabilities().
 */
export const DEFAULT_RBAC_CAPABILITIES: RBACCapabilities = {
  multiRole: false,
  dynamicRoles: false,
  providerManagedRoles: false,
  permissionEditing: false,
  roleAssignment: false,
  roleInheritance: false,
  roleSource: 'config',
};

/**
 * Definition of a role with its permissions.
 * Uses type-safe permission patterns derived from SERVER_ROUTES.
 */
export interface RoleDefinition {
  /** Unique role identifier */
  id: string;
  /** Human-readable role name */
  name: string;
  /** Role description */
  description?: string;
  /** Permissions granted by this role (type-safe Mastra permissions) */
  permissions: PermissionPattern[];
  /** Role IDs this role inherits from */
  inherits?: string[];
  /**
   * Provider-specific permissions (for display purposes).
   * These are the raw permissions from the auth provider (WorkOS, Auth0, etc.)
   * that may not match Mastra's permission patterns.
   */
  providerPermissions?: string[];
  /**
   * Additional metadata about the role.
   */
  metadata?: {
    /** Where the role definition comes from */
    source?: 'provider' | 'roleMapping' | 'storage';
    /** Resource type slug (WorkOS-specific) */
    resourceTypeSlug?: string;
    /** Role type (environment-level or organization-specific) */
    type?: string;
    /** Custom metadata from provider */
    [key: string]: unknown;
  };
}

/**
 * Role mapping configuration for translating provider roles to Mastra permissions.
 * Uses type-safe permission patterns derived from SERVER_ROUTES.
 *
 * Use this when your identity provider (WorkOS, Okta, Azure AD, etc.) has its own
 * roles that need to be translated to Mastra's permission model.
 *
 * Special keys:
 * - `_default`: Permissions for roles not explicitly mapped
 *
 * @example
 * ```typescript
 * const roleMapping: RoleMapping = {
 *   "Engineering": ["agents:*", "workflows:*"],
 *   "Product": ["agents:read", "workflows:read"],
 *   "Admin": ["*"],
 *   "_default": [],  // unmapped roles get no permissions
 * };
 * ```
 */
export type RoleMapping = {
  /** Map role name to array of permission patterns */
  [role: string]: PermissionPattern[];
};

/**
 * Provider interface for role-based access control (read-only).
 *
 * Implement this interface to enable:
 * - Permission-based UI gating
 * - Role display in user menu
 * - Access control checks
 *
 * RBAC providers can be used independently of auth providers:
 *
 * @example Using StaticRBACProvider with Better Auth
 * ```typescript
 * // Better Auth handles authentication only
 * const auth = new MastraAuthBetterAuth({ betterAuth });
 *
 * // Static RBAC handles authorization
 * const rbac = new StaticRBACProvider({
 *   roles: DEFAULT_ROLES,
 *   getUserRoles: (user) => [user.role],
 * });
 *
 * const mastra = new Mastra({
 *   server: {
 *     auth,
 *     rbac,
 *   },
 * });
 * ```
 *
 * @example Using MastraRBACClerk with role mapping
 * ```typescript
 * const mastra = new Mastra({
 *   server: {
 *     auth: new MastraAuthClerk({ clerk }),
 *     rbac: new MastraRBACClerk({
 *       clerk,
 *       roleMapping: {
 *         "org:admin": ["*"],
 *         "org:member": ["agents:read", "workflows:read"],
 *       },
 *     }),
 *   },
 * });
 * ```
 */
export interface IRBACProvider<TUser = unknown> {
  /**
   * Optional role mapping for translating provider roles to Mastra permissions.
   * If provided, permissions are resolved using this mapping instead of getPermissions().
   */
  roleMapping?: RoleMapping;

  /**
   * Get the capabilities of this RBAC provider.
   * Used by the UI to adapt its behavior based on what the provider supports.
   *
   * @returns Provider capabilities
   */
  getCapabilities(): RBACCapabilities;

  /**
   * List all available role definitions.
   * This may come from:
   * - Provider API (WorkOS, Auth0)
   * - Static roleMapping config
   * - Mastra storage (custom roles)
   *
   * @returns Array of role definitions with permissions
   */
  listRoleDefinitions(): Promise<RoleDefinition[]>;

  /**
   * Get all roles for a user.
   *
   * @param user - User to get roles for
   * @returns Array of role IDs
   */
  getRoles(user: TUser): Promise<string[]>;

  /**
   * Check if user has a specific role.
   *
   * @param user - User to check
   * @param role - Role ID to check for
   * @returns True if user has the role
   */
  hasRole(user: TUser, role: string): Promise<boolean>;

  /**
   * Get all permissions for a user (resolved from roles).
   *
   * @param user - User to get permissions for
   * @returns Array of permission strings
   */
  getPermissions(user: TUser): Promise<string[]>;

  /**
   * Check if user has a specific permission.
   *
   * @param user - User to check
   * @param permission - Permission to check for
   * @returns True if user has the permission
   */
  hasPermission(user: TUser, permission: string): Promise<boolean>;

  /**
   * Check if user has ALL of the specified permissions.
   *
   * @param user - User to check
   * @param permissions - Permissions to check for
   * @returns True if user has all permissions
   */
  hasAllPermissions(user: TUser, permissions: string[]): Promise<boolean>;

  /**
   * Check if user has ANY of the specified permissions.
   *
   * @param user - User to check
   * @param permissions - Permissions to check for
   * @returns True if user has at least one permission
   */
  hasAnyPermission(user: TUser, permissions: string[]): Promise<boolean>;
}

/**
 * Extended interface for managing roles (write operations).
 *
 * Implement this in addition to IRBACProvider to enable role management.
 * Not all methods are required - check capabilities to know what's supported.
 */
export interface IRBACManager<TUser = unknown> extends IRBACProvider<TUser> {
  /**
   * Assign a role to a user.
   * For single-role providers (like WorkOS), this replaces the current role.
   * For multi-role providers, this adds the role to the user's roles.
   *
   * @param userId - User to assign role to
   * @param roleId - Role to assign
   */
  assignRole(userId: string, roleId: string): Promise<void>;

  /**
   * Remove a role from a user.
   * For single-role providers, this may not be supported (use assignRole to change).
   * For multi-role providers, this removes one role from the user's roles.
   *
   * @param userId - User to remove role from
   * @param roleId - Role to remove
   */
  removeRole(userId: string, roleId: string): Promise<void>;

  /**
   * Optional: Create a new role definition.
   * Only available if capabilities.dynamicRoles is true.
   *
   * @param role - Role definition to create
   * @returns The created role (may include generated ID)
   */
  createRole?(role: Omit<RoleDefinition, 'id'> & { id?: string }): Promise<RoleDefinition>;

  /**
   * Optional: Update an existing role definition.
   * Only available if capabilities.dynamicRoles is true.
   *
   * @param roleId - Role ID to update
   * @param updates - Partial role definition with updates
   * @returns The updated role
   */
  updateRole?(roleId: string, updates: Partial<Omit<RoleDefinition, 'id'>>): Promise<RoleDefinition>;

  /**
   * Optional: Delete a role definition.
   * Only available if capabilities.dynamicRoles is true.
   *
   * @param roleId - Role ID to delete
   */
  deleteRole?(roleId: string): Promise<void>;
}
