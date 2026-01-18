/**
 * Role-Based Access Control (RBAC) interfaces for Mastra Enterprise Edition.
 *
 * RBAC provides role and permission-based authorization that is fully decoupled
 * from authentication. This allows you to layer RBAC on top of any auth provider
 * using the withEE() composition helper.
 *
 * Permissions use dot-notation for hierarchical organization:
 * - 'agents:read' - Read agent configurations
 * - 'agents:write' - Modify agent configurations
 * - 'agents:*' - All agent permissions (wildcard)
 * - '*' - All permissions (super admin)
 *
 * @packageDocumentation
 */

import type { EEUser } from './user.js';

/**
 * Role mapping configuration for static RBAC.
 * Maps role names to arrays of permission strings.
 *
 * @example
 * ```ts
 * const roleMapping: RoleMapping = {
 *   owner: ['*'],
 *   admin: ['studio:*', 'agents:*', 'workflows:*'],
 *   member: ['agents:read', 'workflows:execute'],
 *   viewer: ['agents:read', 'workflows:read']
 * };
 * ```
 */
export type RoleMapping = {
  [role: string]: string[];
};

/**
 * Role definition with ID, name, and permissions.
 * Used for dynamic RBAC systems that store roles in a database.
 */
export interface Role {
  /** Unique role identifier */
  id: string;

  /** Human-readable role name */
  name: string;

  /** Array of permission strings granted by this role */
  permissions: string[];
}

/**
 * Role-Based Access Control provider interface.
 *
 * RBAC is fully decoupled from authentication - you can add RBAC to any auth
 * provider using the withEE() composition helper. This allows you to:
 * - Use WorkOS auth with custom RBAC logic
 * - Add RBAC to simple email/password auth
 * - Combine multiple RBAC sources (e.g., static + database)
 *
 * @typeParam TUser - User type extending EEUser
 *
 * @example
 * ```ts
 * class CustomRBACProvider implements IRBACProvider<MyUser> {
 *   roleMapping = {
 *     admin: ['*'],
 *     member: ['agents:read', 'workflows:execute']
 *   };
 *
 *   async getRoles(user: MyUser): Promise<string[]> {
 *     return user.roles || [];
 *   }
 *
 *   async hasRole(user: MyUser, role: string): Promise<boolean> {
 *     const roles = await this.getRoles(user);
 *     return roles.includes(role);
 *   }
 *
 *   async getPermissions(user: MyUser): Promise<string[]> {
 *     const roles = await this.getRoles(user);
 *     const permissions = new Set<string>();
 *
 *     for (const role of roles) {
 *       const rolePerms = this.roleMapping[role] || [];
 *       rolePerms.forEach(p => permissions.add(p));
 *     }
 *
 *     return Array.from(permissions);
 *   }
 *
 *   async hasPermission(user: MyUser, permission: string): Promise<boolean> {
 *     const permissions = await this.getPermissions(user);
 *     // Handle wildcard permissions
 *     if (permissions.includes('*')) return true;
 *     // Handle exact match
 *     if (permissions.includes(permission)) return true;
 *     // Handle namespace wildcard (e.g., 'agents:*' matches 'agents:read')
 *     const [namespace] = permission.split(':');
 *     if (permissions.includes(`${namespace}:*`)) return true;
 *     return false;
 *   }
 *
 *   async hasAllPermissions(user: MyUser, permissions: string[]): Promise<boolean> {
 *     for (const permission of permissions) {
 *       if (!(await this.hasPermission(user, permission))) {
 *         return false;
 *       }
 *     }
 *     return true;
 *   }
 *
 *   async hasAnyPermission(user: MyUser, permissions: string[]): Promise<boolean> {
 *     for (const permission of permissions) {
 *       if (await this.hasPermission(user, permission)) {
 *         return true;
 *       }
 *     }
 *     return false;
 *   }
 * }
 * ```
 */
export interface IRBACProvider<TUser extends EEUser = EEUser> {
  /**
   * Optional static role mapping for simple RBAC configurations.
   * Maps role names to permission arrays.
   *
   * If provided, this mapping is used by the default permission expansion logic.
   * For dynamic role systems, implement custom getPermissions() instead.
   */
  roleMapping?: RoleMapping;

  /**
   * Get all roles assigned to a user.
   *
   * Roles are extracted from the user object or fetched from an external system.
   * The implementation determines where roles are stored (user metadata, database, API).
   *
   * @param user - User to check roles for
   * @returns Array of role names (e.g., ['admin', 'member'])
   *
   * @example
   * ```ts
   * // Extract from user metadata
   * async getRoles(user: MyUser): Promise<string[]> {
   *   return user.roles || [];
   * }
   *
   * // Fetch from database
   * async getRoles(user: MyUser): Promise<string[]> {
   *   const membership = await db.orgMemberships.findOne({
   *     userId: user.id,
   *     orgId: user.currentOrgId
   *   });
   *   return membership?.roles || ['viewer'];
   * }
   * ```
   */
  getRoles(user: TUser): Promise<string[]>;

  /**
   * Check if a user has a specific role.
   *
   * @param user - User to check
   * @param role - Role name to check for
   * @returns True if user has the role
   *
   * @example
   * ```ts
   * const isAdmin = await rbac.hasRole(user, 'admin');
   * if (isAdmin) {
   *   // Allow admin actions
   * }
   * ```
   */
  hasRole(user: TUser, role: string): Promise<boolean>;

  /**
   * Get all permissions granted to a user across all their roles.
   *
   * Permissions are expanded from roles using the roleMapping or custom logic.
   * Supports wildcard permissions ('*' for all, 'namespace:*' for namespace).
   *
   * @param user - User to get permissions for
   * @returns Array of permission strings (e.g., ['agents:read', 'workflows:*'])
   *
   * @example
   * ```ts
   * // Expand from static role mapping
   * async getPermissions(user: MyUser): Promise<string[]> {
   *   const roles = await this.getRoles(user);
   *   const permissions = new Set<string>();
   *
   *   for (const role of roles) {
   *     const rolePerms = this.roleMapping[role] || [];
   *     rolePerms.forEach(p => permissions.add(p));
   *   }
   *
   *   return Array.from(permissions);
   * }
   * ```
   */
  getPermissions(user: TUser): Promise<string[]>;

  /**
   * Check if a user has a specific permission.
   *
   * Supports wildcard matching:
   * - '*' matches any permission
   * - 'agents:*' matches 'agents:read', 'agents:write', etc.
   * - Exact match: 'agents:read' only matches 'agents:read'
   *
   * @param user - User to check
   * @param permission - Permission string to check for (e.g., 'agents:read')
   * @returns True if user has the permission
   *
   * @example
   * ```ts
   * const canReadAgents = await rbac.hasPermission(user, 'agents:read');
   * if (!canReadAgents) {
   *   throw new Error('Forbidden');
   * }
   * ```
   */
  hasPermission(user: TUser, permission: string): Promise<boolean>;

  /**
   * Check if a user has ALL of the specified permissions.
   *
   * @param user - User to check
   * @param permissions - Array of permission strings (all must be present)
   * @returns True if user has all permissions
   *
   * @example
   * ```ts
   * const canManageAgents = await rbac.hasAllPermissions(user, [
   *   'agents:read',
   *   'agents:write',
   *   'agents:delete'
   * ]);
   * ```
   */
  hasAllPermissions(user: TUser, permissions: string[]): Promise<boolean>;

  /**
   * Check if a user has ANY of the specified permissions.
   *
   * @param user - User to check
   * @param permissions - Array of permission strings (at least one must be present)
   * @returns True if user has any of the permissions
   *
   * @example
   * ```ts
   * const canAccessWorkflows = await rbac.hasAnyPermission(user, [
   *   'workflows:read',
   *   'workflows:execute',
   *   'workflows:write'
   * ]);
   * ```
   */
  hasAnyPermission(user: TUser, permissions: string[]): Promise<boolean>;
}
