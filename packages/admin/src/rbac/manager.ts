import { MastraAdminError } from '../errors';
import type { AdminStorage } from '../storage/base';

import { getSystemRole, roleHasPermission, SYSTEM_ROLES } from './roles';
import type { Permission, PermissionContext, Role , RBACResource } from './types';
import { RBACAction } from './types';

/**
 * RBAC manager for permission checks.
 */
export class RBACManager {
  constructor(private readonly storage: AdminStorage) {}

  /**
   * Check if a user has a specific permission in a context.
   */
  async hasPermission(context: PermissionContext, permission: Permission): Promise<boolean> {
    const { userId, teamId } = context;

    // Get user's role in the team
    const member = await this.storage.getTeamMember(teamId, userId);
    if (!member) {
      return false;
    }

    // Get role definition
    const role = getSystemRole(member.role);
    if (!role) {
      return false;
    }

    return roleHasPermission(role, permission);
  }

  /**
   * Assert that a user has a permission. Throws if not.
   */
  async assertPermission(context: PermissionContext, permission: Permission): Promise<void> {
    const hasPermission = await this.hasPermission(context, permission);
    if (!hasPermission) {
      const [resource, action] = permission.split(':') as [RBACResource, RBACAction];
      throw MastraAdminError.accessDenied(resource, action);
    }
  }

  /**
   * Get all permissions for a user in a team.
   */
  async getUserPermissions(userId: string, teamId: string): Promise<Permission[]> {
    const member = await this.storage.getTeamMember(teamId, userId);
    if (!member) {
      return [];
    }

    const role = getSystemRole(member.role);
    if (!role) {
      return [];
    }

    return role.permissions;
  }

  /**
   * Get role for a user in a team.
   */
  async getUserRole(userId: string, teamId: string): Promise<Role | null> {
    const member = await this.storage.getTeamMember(teamId, userId);
    if (!member) {
      return null;
    }

    return getSystemRole(member.role) ?? null;
  }

  /**
   * List all system roles.
   */
  listRoles(): Role[] {
    return Object.values(SYSTEM_ROLES);
  }

  /**
   * Get a role by ID.
   */
  getRole(roleId: string): Role | undefined {
    return getSystemRole(roleId);
  }

  /**
   * Create a permission check helper for a context.
   */
  forContext(context: PermissionContext): ContextualRBAC {
    return new ContextualRBAC(this, context);
  }
}

/**
 * Contextual RBAC helper for checking permissions in a fixed context.
 */
export class ContextualRBAC {
  constructor(
    private readonly manager: RBACManager,
    private readonly context: PermissionContext,
  ) {}

  async can(resource: RBACResource, action: RBACAction): Promise<boolean> {
    return this.manager.hasPermission(this.context, `${resource}:${action}`);
  }

  async assert(resource: RBACResource, action: RBACAction): Promise<void> {
    return this.manager.assertPermission(this.context, `${resource}:${action}`);
  }

  async canCreate(resource: RBACResource): Promise<boolean> {
    return this.can(resource, RBACAction.CREATE);
  }

  async canRead(resource: RBACResource): Promise<boolean> {
    return this.can(resource, RBACAction.READ);
  }

  async canUpdate(resource: RBACResource): Promise<boolean> {
    return this.can(resource, RBACAction.UPDATE);
  }

  async canDelete(resource: RBACResource): Promise<boolean> {
    return this.can(resource, RBACAction.DELETE);
  }
}
