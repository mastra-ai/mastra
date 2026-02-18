/**
 * Mastra Cloud RBAC provider.
 *
 * Provides role-based permission checking for Cloud-authenticated users
 * using configurable role-to-permission mappings.
 */

import type { IRBACProvider, RoleMapping } from '@mastra/core/auth';
import { resolvePermissionsFromMapping, matchesPermission } from '@mastra/core/auth';

import type { CloudUser } from '../types';

/**
 * Configuration options for MastraRBACCloud.
 */
export interface MastraRBACCloudOptions {
  /**
   * Mapping from role names to permission arrays.
   *
   * @example
   * ```typescript
   * {
   *   admin: ['*'],
   *   member: ['agents:read', 'workflows:*'],
   *   viewer: ['agents:read', 'workflows:read'],
   *   _default: [],
   * }
   * ```
   */
  roleMapping: RoleMapping;
}

/**
 * RBAC provider for Mastra Cloud authentication.
 *
 * Maps user roles (from /verify endpoint) to Mastra permissions
 * using a configurable role mapping. This is a simpler implementation
 * than WorkOS RBAC since Cloud uses a single-role model.
 *
 * @example Basic usage
 * ```typescript
 * import { MastraRBACCloud } from '@mastra/auth-cloud';
 *
 * const rbac = new MastraRBACCloud({
 *   roleMapping: {
 *     admin: ['*'],
 *     member: ['agents:read', 'workflows:*'],
 *     viewer: ['agents:read', 'workflows:read'],
 *     _default: [],
 *   },
 * });
 *
 * const hasAccess = await rbac.hasPermission(user, 'agents:read');
 * ```
 */
export class MastraRBACCloud implements IRBACProvider<CloudUser> {
  private options: MastraRBACCloudOptions;

  /**
   * Expose roleMapping for middleware access.
   * This allows the authorization middleware to resolve permissions
   * without needing to call the async methods.
   */
  get roleMapping(): RoleMapping {
    return this.options.roleMapping;
  }

  /**
   * Create a new Mastra Cloud RBAC provider.
   *
   * @param options - RBAC configuration options
   */
  constructor(options: MastraRBACCloudOptions) {
    this.options = options;
  }

  /**
   * Get all roles for a user.
   *
   * Returns the user's role as a single-element array, or empty array if no role.
   * Cloud uses a single-role model (role is attached via verifyToken()).
   *
   * @param user - Cloud user to get roles for
   * @returns Array containing user's role, or empty array
   */
  async getRoles(user: CloudUser): Promise<string[]> {
    // Role attached to user from verifyToken() call
    return user.role ? [user.role] : [];
  }

  /**
   * Check if a user has a specific role.
   *
   * @param user - Cloud user to check
   * @param role - Role name to check for
   * @returns True if user has the role
   */
  async hasRole(user: CloudUser, role: string): Promise<boolean> {
    const roles = await this.getRoles(user);
    return roles.includes(role);
  }

  /**
   * Get all permissions for a user by mapping their role.
   *
   * Uses the configured roleMapping to translate the user's role
   * into Mastra permission strings.
   *
   * If the user has no role, the _default permissions from the
   * role mapping are applied.
   *
   * @param user - Cloud user to get permissions for
   * @returns Array of permission strings
   */
  async getPermissions(user: CloudUser): Promise<string[]> {
    const roles = await this.getRoles(user);

    if (roles.length === 0) {
      return this.options.roleMapping['_default'] ?? [];
    }

    return resolvePermissionsFromMapping(roles, this.options.roleMapping);
  }

  /**
   * Check if a user has a specific permission.
   *
   * Uses wildcard matching to check if the user's permissions
   * grant access to the required permission.
   *
   * @param user - Cloud user to check
   * @param permission - Permission to check for (e.g., 'agents:read')
   * @returns True if user has the permission
   */
  async hasPermission(user: CloudUser, permission: string): Promise<boolean> {
    const permissions = await this.getPermissions(user);
    return permissions.some(p => matchesPermission(p, permission));
  }

  /**
   * Check if a user has ALL of the specified permissions.
   *
   * @param user - Cloud user to check
   * @param permissions - Array of permissions to check for
   * @returns True if user has all permissions
   */
  async hasAllPermissions(user: CloudUser, permissions: string[]): Promise<boolean> {
    const userPermissions = await this.getPermissions(user);
    return permissions.every(required => userPermissions.some(p => matchesPermission(p, required)));
  }

  /**
   * Check if a user has ANY of the specified permissions.
   *
   * @param user - Cloud user to check
   * @param permissions - Array of permissions to check for
   * @returns True if user has at least one permission
   */
  async hasAnyPermission(user: CloudUser, permissions: string[]): Promise<boolean> {
    const userPermissions = await this.getPermissions(user);
    return permissions.some(required => userPermissions.some(p => matchesPermission(p, required)));
  }
}
