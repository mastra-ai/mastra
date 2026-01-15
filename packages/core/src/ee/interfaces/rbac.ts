/**
 * RBAC provider interface for EE authentication.
 * Enables role-based access control in Studio.
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
 * Provider interface for role-based access control (read-only).
 *
 * Implement this interface to enable:
 * - Permission-based UI gating
 * - Role display in user menu
 * - Access control checks
 *
 * @example
 * ```typescript
 * class StaticRBACProvider implements IRBACProvider {
 *   constructor(private roles: RoleDefinition[], private getUserRolesFn: (user) => string[]) {}
 *
 *   async getRoles(user) {
 *     return this.getUserRolesFn(user);
 *   }
 *
 *   async getPermissions(user) {
 *     const roleIds = await this.getRoles(user);
 *     const permissions = new Set<string>();
 *     for (const roleId of roleIds) {
 *       const role = this.roles.find(r => r.id === roleId);
 *       role?.permissions.forEach(p => permissions.add(p));
 *     }
 *     return Array.from(permissions);
 *   }
 *
 *   async hasPermission(user, permission) {
 *     const perms = await this.getPermissions(user);
 *     return perms.includes(permission) || perms.includes('*');
 *   }
 * }
 * ```
 */
export interface IRBACProvider<TUser = unknown> {
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
