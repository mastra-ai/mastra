/**
 * Static RBAC provider with config-based roles.
 */

import type { RoleDefinition, RoleMapping, IRBACProvider } from '../../interfaces';
import { resolvePermissions, matchesPermission, resolvePermissionsFromMapping } from '../roles';

/**
 * Options for StaticRBACProvider.
 *
 * Use ONE of the following approaches:
 * - `roles`: Define role structures with permissions (Mastra's native role system)
 * - `roleMapping`: Map provider roles directly to permissions (simpler for external providers)
 */
export type StaticRBACProviderOptions<TUser = unknown> =
  | {
      /** Role definitions (Mastra's native role system) */
      roles: RoleDefinition[];
      /** Function to get user's role IDs */
      getUserRoles: (user: TUser) => string[] | Promise<string[]>;
      roleMapping?: never;
    }
  | {
      /**
       * Role mapping for translating provider roles to permissions.
       * Use this when your identity provider has roles that need to be
       * mapped to Mastra permissions.
       */
      roleMapping: RoleMapping;
      /** Function to get user's role IDs from the provider */
      getUserRoles: (user: TUser) => string[] | Promise<string[]>;
      roles?: never;
    };

/**
 * Static RBAC provider.
 *
 * Supports two modes:
 * 1. **Role definitions**: Use Mastra's native role system with structured roles
 * 2. **Role mapping**: Directly map provider roles to permissions
 *
 * @example Using role definitions (Mastra's native system)
 * ```typescript
 * const rbac = new StaticRBACProvider({
 *   roles: DEFAULT_ROLES,
 *   getUserRoles: (user) => [user.role],
 * });
 * ```
 *
 * @example Using role mapping (for external providers)
 * ```typescript
 * const rbac = new StaticRBACProvider({
 *   roleMapping: {
 *     "Engineering": ["agents:*", "workflows:*"],
 *     "Product": ["agents:read", "workflows:read"],
 *     "_default": [],
 *   },
 *   getUserRoles: (user) => user.providerRoles,
 * });
 * ```
 *
 * @example Async role lookup
 * ```typescript
 * const rbac = new StaticRBACProvider({
 *   roles: DEFAULT_ROLES,
 *   getUserRoles: async (user) => {
 *     return db.getUserRoles(user.id);
 *   },
 * });
 * ```
 */
export class StaticRBACProvider<TUser = unknown> implements IRBACProvider<TUser> {
  private roles?: RoleDefinition[];
  private _roleMapping?: RoleMapping;
  private getUserRolesFn: (user: TUser) => string[] | Promise<string[]>;
  private permissionCache = new Map<string, string[]>();

  /** Expose roleMapping for middleware access */
  get roleMapping(): RoleMapping | undefined {
    return this._roleMapping;
  }

  constructor(options: StaticRBACProviderOptions<TUser>) {
    if ('roles' in options && options.roles) {
      this.roles = options.roles;
    }
    if ('roleMapping' in options && options.roleMapping) {
      this._roleMapping = options.roleMapping;
    }
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

    // Resolve permissions based on mode
    let permissions: string[];
    if (this._roleMapping) {
      // Role mapping mode: translate provider roles to permissions
      permissions = resolvePermissionsFromMapping(roleIds, this._roleMapping);
    } else if (this.roles) {
      // Role definitions mode: use Mastra's native role system
      permissions = resolvePermissions(roleIds, this.roles);
    } else {
      // No roles or mapping configured
      permissions = [];
    }

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
   * Only available when using role definitions mode (not role mapping).
   */
  getRoleDefinitions(): RoleDefinition[] {
    return this.roles ?? [];
  }

  /**
   * Get a specific role definition.
   * Only available when using role definitions mode (not role mapping).
   */
  getRoleDefinition(roleId: string): RoleDefinition | undefined {
    return this.roles?.find(r => r.id === roleId);
  }
}
