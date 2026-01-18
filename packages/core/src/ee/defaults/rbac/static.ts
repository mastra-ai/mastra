/**
 * Static Role-Based Access Control provider implementation.
 *
 * Uses a static role mapping configuration to determine user permissions.
 * Roles are extracted from the user object via a callback function.
 *
 * @packageDocumentation
 */

import type { EEUser } from '../../interfaces/user.js';
import type { IRBACProvider, RoleMapping } from '../../interfaces/rbac.js';
import { DEFAULT_ROLE_MAPPING } from '../roles.js';

/**
 * Configuration for StaticRBACProvider.
 */
export interface StaticRBACConfig<TUser extends EEUser> {
  /**
   * Static mapping of role names to permission arrays.
   *
   * @default DEFAULT_ROLE_MAPPING
   */
  roleMapping?: RoleMapping;

  /**
   * Callback function to extract roles from user object.
   *
   * @param user - User to extract roles from
   * @returns Array of role names (e.g., ['admin', 'member'])
   *
   * @example
   * ```ts
   * // Extract from user metadata
   * getRolesFromUser: (user) => user.roles || []
   *
   * // Extract from user metadata with organization context
   * getRolesFromUser: (user) => {
   *   const orgId = user.currentOrgId;
   *   return user.orgRoles?.[orgId] || ['viewer'];
   * }
   * ```
   */
  getRolesFromUser: (user: TUser) => string[] | Promise<string[]>;
}

/**
 * Static RBAC provider using role mapping configuration.
 *
 * Implements IRBACProvider using a static role-to-permissions mapping.
 * Roles are extracted from the user object via a configurable callback.
 *
 * Features:
 * - Static role mapping (configurable or uses DEFAULT_ROLE_MAPPING)
 * - Wildcard permission support ('*' for all, 'namespace:*' for namespace)
 * - Permission hierarchy (e.g., 'agents:*' matches 'agents:read')
 * - No database required - all configuration is in-memory
 *
 * @typeParam TUser - User type extending EEUser
 *
 * @example
 * ```ts
 * // Using default role mapping
 * const rbac = new StaticRBACProvider({
 *   getRolesFromUser: (user) => user.roles || []
 * });
 *
 * // Using custom role mapping
 * const rbac = new StaticRBACProvider({
 *   roleMapping: {
 *     superadmin: ['*'],
 *     editor: ['agents:*', 'workflows:write'],
 *     reader: ['agents:read', 'workflows:read']
 *   },
 *   getRolesFromUser: (user) => user.orgRoles?.[user.currentOrgId] || []
 * });
 *
 * // Check permissions
 * const canWrite = await rbac.hasPermission(user, 'agents:write');
 * ```
 */
export class StaticRBACProvider<TUser extends EEUser = EEUser> implements IRBACProvider<TUser> {
  readonly roleMapping: RoleMapping;
  private readonly getRolesFromUser: (user: TUser) => string[] | Promise<string[]>;

  constructor(config: StaticRBACConfig<TUser>) {
    this.roleMapping = config.roleMapping || DEFAULT_ROLE_MAPPING;
    this.getRolesFromUser = config.getRolesFromUser;
  }

  /**
   * Get all roles assigned to a user.
   *
   * @param user - User to get roles for
   * @returns Array of role names
   */
  async getRoles(user: TUser): Promise<string[]> {
    return Promise.resolve(this.getRolesFromUser(user));
  }

  /**
   * Check if a user has a specific role.
   *
   * @param user - User to check
   * @param role - Role name to check for
   * @returns True if user has the role
   */
  async hasRole(user: TUser, role: string): Promise<boolean> {
    const roles = await this.getRoles(user);
    return roles.includes(role);
  }

  /**
   * Get all permissions granted to a user across all their roles.
   *
   * Expands roles to permissions using the role mapping configuration.
   * Duplicate permissions are automatically removed.
   *
   * @param user - User to get permissions for
   * @returns Array of unique permission strings
   */
  async getPermissions(user: TUser): Promise<string[]> {
    const roles = await this.getRoles(user);
    const permissions = new Set<string>();

    for (const role of roles) {
      const rolePerms = this.roleMapping[role] || [];
      rolePerms.forEach(p => permissions.add(p));
    }

    return Array.from(permissions);
  }

  /**
   * Check if a user has a specific permission.
   *
   * Supports wildcard matching:
   * - '*' matches any permission (super admin)
   * - 'namespace:*' matches all permissions in namespace (e.g., 'agents:*')
   * - Exact match: 'agents:read' only matches 'agents:read'
   *
   * @param user - User to check
   * @param permission - Permission string to check for
   * @returns True if user has the permission
   *
   * @example
   * ```ts
   * // User with ['*'] permission
   * await rbac.hasPermission(user, 'agents:read'); // true (wildcard)
   *
   * // User with ['agents:*'] permission
   * await rbac.hasPermission(user, 'agents:read'); // true (namespace wildcard)
   * await rbac.hasPermission(user, 'workflows:read'); // false
   *
   * // User with ['agents:read'] permission
   * await rbac.hasPermission(user, 'agents:read'); // true (exact match)
   * await rbac.hasPermission(user, 'agents:write'); // false
   * ```
   */
  async hasPermission(user: TUser, permission: string): Promise<boolean> {
    const permissions = await this.getPermissions(user);

    // Check for super admin wildcard
    if (permissions.includes('*')) {
      return true;
    }

    // Check for exact match
    if (permissions.includes(permission)) {
      return true;
    }

    // Check for namespace wildcard (e.g., 'agents:*' matches 'agents:read')
    const [namespace] = permission.split(':');
    if (namespace && permissions.includes(`${namespace}:*`)) {
      return true;
    }

    return false;
  }

  /**
   * Check if a user has ALL of the specified permissions.
   *
   * @param user - User to check
   * @param permissions - Array of permission strings (all must be present)
   * @returns True if user has all permissions
   *
   * @example
   * ```ts
   * const canManage = await rbac.hasAllPermissions(user, [
   *   'agents:read',
   *   'agents:write',
   *   'agents:delete'
   * ]);
   * if (canManage) {
   *   // User can fully manage agents
   * }
   * ```
   */
  async hasAllPermissions(user: TUser, permissions: string[]): Promise<boolean> {
    for (const permission of permissions) {
      if (!(await this.hasPermission(user, permission))) {
        return false;
      }
    }
    return true;
  }

  /**
   * Check if a user has ANY of the specified permissions.
   *
   * @param user - User to check
   * @param permissions - Array of permission strings (at least one must be present)
   * @returns True if user has any of the permissions
   *
   * @example
   * ```ts
   * const canAccess = await rbac.hasAnyPermission(user, [
   *   'workflows:read',
   *   'workflows:execute',
   *   'workflows:write'
   * ]);
   * if (canAccess) {
   *   // User has some level of workflow access
   * }
   * ```
   */
  async hasAnyPermission(user: TUser, permissions: string[]): Promise<boolean> {
    for (const permission of permissions) {
      if (await this.hasPermission(user, permission)) {
        return true;
      }
    }
    return false;
  }
}
