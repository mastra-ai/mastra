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

/**
 * Definition of a role with its permissions.
 */
export interface RoleDefinition {
  /** Unique role identifier */
  id: string;
  /** Human-readable role name */
  name: string;
  /** Role description */
  description?: string;
  /** Permissions granted by this role */
  permissions: string[];
  /** Role IDs this role inherits from */
  inherits?: string[];
}

/**
 * Role mapping configuration for translating provider roles to Mastra permissions.
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
  /** Map role name to array of permissions */
  [role: string]: string[];
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
 */
export interface IRBACManager<TUser = unknown> extends IRBACProvider<TUser> {
  /**
   * Assign a role to a user.
   *
   * @param userId - User to assign role to
   * @param roleId - Role to assign
   */
  assignRole(userId: string, roleId: string): Promise<void>;

  /**
   * Remove a role from a user.
   *
   * @param userId - User to remove role from
   * @param roleId - Role to remove
   */
  removeRole(userId: string, roleId: string): Promise<void>;

  /**
   * List all available roles.
   *
   * @returns Array of role definitions
   */
  listRoles(): Promise<RoleDefinition[]>;

  /**
   * Optional: Create a new role.
   *
   * @param role - Role definition to create
   */
  createRole?(role: RoleDefinition): Promise<void>;

  /**
   * Optional: Delete a role.
   *
   * @param roleId - Role ID to delete
   */
  deleteRole?(roleId: string): Promise<void>;
}
