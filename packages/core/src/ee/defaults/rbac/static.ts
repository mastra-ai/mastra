/**
 * Static RBAC provider with config-based roles.
 */

import type { RoleDefinition, IRBACProvider } from '../../interfaces';
import { resolvePermissions, matchesPermission } from '../roles';

/**
 * Options for StaticRBACProvider.
 */
export interface StaticRBACProviderOptions<TUser = unknown> {
  /** Role definitions */
  roles: RoleDefinition[];
  /** Function to get user's role IDs */
  getUserRoles: (user: TUser) => string[] | Promise<string[]>;
}

/**
 * Static RBAC provider.
 *
 * Uses a static list of role definitions and a function to resolve
 * which roles a user has.
 *
 * @example
 * ```typescript
 * const rbac = new StaticRBACProvider({
 *   roles: DEFAULT_ROLES,
 *   getUserRoles: (user) => [user.role], // Get role from user object
 * });
 *
 * // Or with async lookup
 * const rbac = new StaticRBACProvider({
 *   roles: DEFAULT_ROLES,
 *   getUserRoles: async (user) => {
 *     return db.getUserRoles(user.id);
 *   },
 * });
 * ```
 */
export class StaticRBACProvider<TUser = unknown> implements IRBACProvider<TUser> {
  private roles: RoleDefinition[];
  private getUserRolesFn: (user: TUser) => string[] | Promise<string[]>;
  private permissionCache = new Map<string, string[]>();

  constructor(options: StaticRBACProviderOptions<TUser>) {
    this.roles = options.roles;
    this.getUserRolesFn = options.getUserRoles;
  }

  async getRoles(user: TUser): Promise<string[]> {
    const roleIds = await this.getUserRolesFn(user);
    return roleIds;
  }

  async hasRole(user: TUser, role: string): Promise<boolean> {
    const roles = await this.getRoles(user);
    return roles.includes(role);
  }

  async getPermissions(user: TUser): Promise<string[]> {
    const roleIds = await this.getRoles(user);

    // Check cache
    const cacheKey = roleIds.sort().join(',');
    const cached = this.permissionCache.get(cacheKey);
    if (cached) return cached;

    // Resolve permissions
    const permissions = resolvePermissions(roleIds, this.roles);

    // Cache result
    this.permissionCache.set(cacheKey, permissions);

    return permissions;
  }

  async hasPermission(user: TUser, permission: string): Promise<boolean> {
    const permissions = await this.getPermissions(user);
    return permissions.some(p => matchesPermission(p, permission));
  }

  async hasAllPermissions(user: TUser, permissions: string[]): Promise<boolean> {
    const userPermissions = await this.getPermissions(user);
    return permissions.every(required => userPermissions.some(p => matchesPermission(p, required)));
  }

  async hasAnyPermission(user: TUser, permissions: string[]): Promise<boolean> {
    const userPermissions = await this.getPermissions(user);
    return permissions.some(required => userPermissions.some(p => matchesPermission(p, required)));
  }

  /**
   * Clear the permission cache.
   */
  clearCache(): void {
    this.permissionCache.clear();
  }

  /**
   * Get all role definitions.
   */
  getRoleDefinitions(): RoleDefinition[] {
    return this.roles;
  }

  /**
   * Get a specific role definition.
   */
  getRoleDefinition(roleId: string): RoleDefinition | undefined {
    return this.roles.find(r => r.id === roleId);
  }
}
