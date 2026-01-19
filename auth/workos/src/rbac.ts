/**
 * WorkOS RBAC provider implementation.
 *
 * Implements the IRBACProvider interface for role-based access control
 * using WorkOS organization memberships and role mappings.
 *
 * @module auth-workos/rbac
 */

import type { IRBACProvider, RoleMapping } from '@mastra/core/ee';
import { DEFAULT_ROLE_MAPPING } from '@mastra/core/ee';
import type { WorkOS } from '@workos-inc/node';

import type { WorkOSUser } from './types.js';

/**
 * Configuration for WorkOS RBAC provider.
 */
export interface WorkOSRBACConfig {
  /**
   * Optional role mapping for converting WorkOS roles to Mastra permissions.
   * Defaults to DEFAULT_ROLE_MAPPING from @mastra/core/ee.
   *
   * @example
   * ```typescript
   * const roleMapping = {
   *   owner: ['*'],
   *   admin: ['studio:*', 'agents:*', 'workflows:*'],
   *   member: ['agents:read', 'workflows:execute']
   * };
   * ```
   */
  roleMapping?: RoleMapping;

  /**
   * Optional organization ID to use for role lookups.
   * If not provided, uses the organization from user's session.
   */
  organizationId?: string;
}

/**
 * WorkOS RBAC provider for role-based access control.
 *
 * Extracts roles from WorkOS organization membership and maps them to
 * Mastra permissions using a configurable role mapping.
 *
 * Supports:
 * - Role extraction from organization membership
 * - Permission expansion with wildcard support ('*', 'namespace:*')
 * - Custom role mapping or default Mastra roles
 *
 * @example
 * ```typescript
 * const rbacProvider = new MastraRBACWorkos(workos, { roleMapping });
 * const roles = await rbacProvider.getRoles(user);
 * const canReadAgents = await rbacProvider.hasPermission(user, 'agents:read');
 * ```
 */
export class MastraRBACWorkos implements IRBACProvider<WorkOSUser> {
  public readonly roleMapping: RoleMapping;
  private organizationId?: string;

  constructor(
    private workos: WorkOS,
    config?: WorkOSRBACConfig,
  ) {
    this.roleMapping = config?.roleMapping || DEFAULT_ROLE_MAPPING;
    this.organizationId = config?.organizationId;
  }

  /**
   * Get all roles assigned to a user from their WorkOS organization membership.
   *
   * @param user - WorkOS user to get roles for
   * @returns Array of role names
   */
  async getRoles(user: WorkOSUser): Promise<string[]> {
    try {
      // Use organization from config or user's session
      const orgId = this.organizationId || user.workos.organizationId;

      if (!orgId) {
        // User not part of an organization, return default viewer role
        return ['viewer'];
      }

      // List organization memberships for the user
      const memberships = await this.workos.userManagement.listOrganizationMemberships({
        organizationId: orgId,
        userId: user.id,
      });

      // Get the first membership (user should only have one per org)
      const membership = memberships.data[0];
      if (!membership) {
        return ['viewer'];
      }

      // Extract role from membership
      const role = membership.role?.slug || user.workos.role || 'viewer';

      return [role];
    } catch {
      // Organization membership not found, return default viewer role
      return ['viewer'];
    }
  }

  /**
   * Check if a user has a specific role.
   *
   * @param user - User to check
   * @param role - Role name to check for
   * @returns True if user has the role
   */
  async hasRole(user: WorkOSUser, role: string): Promise<boolean> {
    const roles = await this.getRoles(user);
    return roles.includes(role);
  }

  /**
   * Get all permissions granted to a user by expanding their roles.
   *
   * @param user - User to get permissions for
   * @returns Array of permission strings
   */
  async getPermissions(user: WorkOSUser): Promise<string[]> {
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
   * - 'agents:*' matches any agent permission (namespace wildcard)
   * - 'agents:read' exact match
   *
   * @param user - User to check
   * @param permission - Permission string to check for
   * @returns True if user has the permission
   */
  async hasPermission(user: WorkOSUser, permission: string): Promise<boolean> {
    const permissions = await this.getPermissions(user);

    // Super admin wildcard - grants all permissions
    if (permissions.includes('*')) {
      return true;
    }

    // Exact match
    if (permissions.includes(permission)) {
      return true;
    }

    // Namespace wildcard (e.g., 'agents:*' matches 'agents:read')
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
   */
  async hasAllPermissions(user: WorkOSUser, permissions: string[]): Promise<boolean> {
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
   */
  async hasAnyPermission(user: WorkOSUser, permissions: string[]): Promise<boolean> {
    for (const permission of permissions) {
      if (await this.hasPermission(user, permission)) {
        return true;
      }
    }
    return false;
  }
}
