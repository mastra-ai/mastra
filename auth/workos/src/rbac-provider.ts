/**
 * WorkOS RBAC provider for Mastra.
 *
 * Integrates WorkOS organization memberships and roles with Mastra's
 * permission-based access control system.
 */

import { WorkOS } from '@workos-inc/node';
import type { IRBACProvider, RoleMapping } from '@mastra/core/ee';
import { resolvePermissionsFromMapping, matchesPermission } from '@mastra/core/ee';

import type { WorkOSUser, MastraRBACWorkosOptions } from './types';

/**
 * Extended options that include the WorkOS client.
 */
interface MastraRBACWorkosFullOptions extends MastraRBACWorkosOptions {
  /** WorkOS client instance */
  workos: WorkOS;
}

/**
 * WorkOS RBAC provider that maps organization roles to Mastra permissions.
 *
 * This provider fetches organization memberships from WorkOS and translates
 * role slugs into Mastra permissions using a configurable role mapping.
 *
 * @example Basic usage
 * ```typescript
 * import { WorkOS } from '@workos-inc/node';
 * import { MastraRBACWorkos } from '@mastra/auth-workos';
 *
 * const workos = new WorkOS(process.env.WORKOS_API_KEY);
 *
 * const rbac = new MastraRBACWorkos({
 *   workos,
 *   roleMapping: {
 *     admin: ['*'],
 *     member: ['agents:read', 'workflows:*'],
 *     viewer: ['agents:read', 'workflows:read'],
 *     _default: [],
 *   },
 * });
 * ```
 *
 * @example With specific organization
 * ```typescript
 * const rbac = new MastraRBACWorkos({
 *   workos,
 *   organizationId: 'org_123456',
 *   roleMapping: {
 *     admin: ['*'],
 *     member: ['agents:*'],
 *   },
 * });
 * ```
 */
export class MastraRBACWorkos implements IRBACProvider<WorkOSUser> {
  private workos: WorkOS;
  private options: MastraRBACWorkosOptions;
  private permissionCache = new Map<string, string[]>();

  /**
   * Expose roleMapping for middleware access.
   * This allows the authorization middleware to resolve permissions
   * without needing to call the async methods.
   */
  get roleMapping(): RoleMapping {
    return this.options.roleMapping;
  }

  /**
   * Create a new WorkOS RBAC provider.
   *
   * @param options - RBAC configuration options including WorkOS client
   */
  constructor(options: MastraRBACWorkosFullOptions) {
    this.workos = options.workos;
    this.options = options;

    console.log(`[WorkOS RBAC] Initialized with roleMapping keys: ${Object.keys(this.options.roleMapping).join(', ')}`);
  }

  /**
   * Get all roles for a user from their WorkOS organization memberships.
   *
   * Fetches organization memberships from WorkOS and extracts role slugs.
   * If an organizationId is configured, only returns roles from that organization.
   * Otherwise, returns roles from all organizations the user belongs to.
   *
   * @param user - WorkOS user to get roles for
   * @returns Array of role slugs
   */
  async getRoles(user: WorkOSUser): Promise<string[]> {
    console.log(`[WorkOS RBAC] getRoles called for user ${user.id}, workosId=${user.workosId}`);

    // If memberships are already present on the user object, use them
    if (user.memberships && user.memberships.length > 0) {
      const roles = this.extractRolesFromMemberships(user);
      console.log(`[WorkOS RBAC] Using cached memberships, roles: ${JSON.stringify(roles)}`);
      return roles;
    }

    // Fetch memberships from WorkOS
    try {
      console.log(`[WorkOS RBAC] Fetching memberships from WorkOS for user ${user.workosId}`);
      const memberships = await this.workos.userManagement.listOrganizationMemberships({
        userId: user.workosId,
      });
      console.log(`[WorkOS RBAC] Found ${memberships.data.length} memberships`);

      // Filter by organization if specified
      const relevantMemberships = this.options.organizationId
        ? memberships.data.filter(m => m.organizationId === this.options.organizationId)
        : memberships.data;

      // Extract role slugs
      const roles = relevantMemberships.map(m => m.role.slug);
      console.log(`[WorkOS RBAC] Extracted roles: ${JSON.stringify(roles)}`);
      return roles;
    } catch (error) {
      console.error(`[WorkOS RBAC] Error fetching memberships:`, error);
      // Return empty roles on error - _default permissions will be applied
      return [];
    }
  }

  /**
   * Check if a user has a specific role.
   *
   * @param user - WorkOS user to check
   * @param role - Role slug to check for
   * @returns True if user has the role
   */
  async hasRole(user: WorkOSUser, role: string): Promise<boolean> {
    const roles = await this.getRoles(user);
    return roles.includes(role);
  }

  /**
   * Get all permissions for a user by mapping their WorkOS roles.
   *
   * Uses the configured roleMapping to translate WorkOS role slugs
   * into Mastra permission strings. Results are cached by user ID
   * for performance.
   *
   * If the user has no roles (no organization memberships), the
   * _default permissions from the role mapping are applied.
   *
   * @param user - WorkOS user to get permissions for
   * @returns Array of permission strings
   */
  async getPermissions(user: WorkOSUser): Promise<string[]> {
    console.log(`[WorkOS RBAC] getPermissions called for user ${user.id}`);

    // Check cache first
    const cached = this.permissionCache.get(user.id);
    if (cached) {
      console.log(`[WorkOS RBAC] Returning cached permissions: ${JSON.stringify(cached)}`);
      return cached;
    }

    // Get roles and resolve permissions
    const roles = await this.getRoles(user);

    let permissions: string[];
    if (roles.length === 0) {
      // No roles - apply _default permissions
      permissions = this.options.roleMapping['_default'] ?? [];
      console.log(`[WorkOS RBAC] No roles, using _default permissions: ${JSON.stringify(permissions)}`);
    } else {
      permissions = resolvePermissionsFromMapping(roles, this.options.roleMapping);
      console.log(`[WorkOS RBAC] Resolved permissions from roles: ${JSON.stringify(permissions)}`);
    }

    // Cache the result
    this.permissionCache.set(user.id, permissions);

    return permissions;
  }

  /**
   * Check if a user has a specific permission.
   *
   * Uses wildcard matching to check if any of the user's permissions
   * grant access to the required permission.
   *
   * @param user - WorkOS user to check
   * @param permission - Permission to check for (e.g., 'agents:read')
   * @returns True if user has the permission
   */
  async hasPermission(user: WorkOSUser, permission: string): Promise<boolean> {
    const permissions = await this.getPermissions(user);
    return permissions.some(p => matchesPermission(p, permission));
  }

  /**
   * Check if a user has ALL of the specified permissions.
   *
   * @param user - WorkOS user to check
   * @param permissions - Array of permissions to check for
   * @returns True if user has all permissions
   */
  async hasAllPermissions(user: WorkOSUser, permissions: string[]): Promise<boolean> {
    const userPermissions = await this.getPermissions(user);
    return permissions.every(required => userPermissions.some(p => matchesPermission(p, required)));
  }

  /**
   * Check if a user has ANY of the specified permissions.
   *
   * @param user - WorkOS user to check
   * @param permissions - Array of permissions to check for
   * @returns True if user has at least one permission
   */
  async hasAnyPermission(user: WorkOSUser, permissions: string[]): Promise<boolean> {
    const userPermissions = await this.getPermissions(user);
    return permissions.some(required => userPermissions.some(p => matchesPermission(p, required)));
  }

  /**
   * Clear the permission cache.
   *
   * Call this when user roles change to ensure fresh permission resolution.
   * Useful after role assignments or when memberships are updated.
   */
  clearCache(): void {
    this.permissionCache.clear();
  }

  /**
   * Extract role slugs from memberships attached to the user object.
   *
   * @param user - WorkOS user with memberships
   * @returns Array of role slugs
   */
  private extractRolesFromMemberships(user: WorkOSUser): string[] {
    if (!user.memberships) {
      return [];
    }

    // Filter by organization if specified
    const relevantMemberships = this.options.organizationId
      ? user.memberships.filter(m => m.organizationId === this.options.organizationId)
      : user.memberships;

    return relevantMemberships.map(m => m.role.slug);
  }
}
