import type { TeamRole } from '@mastra/admin';
import { AdminPgDB, TABLES } from '../db';
import type { PgDomainConfig } from './utils';
import { resolvePgConfig } from './utils';

/**
 * Permission mappings for team roles.
 * These define what actions each role can perform.
 */
const ROLE_PERMISSIONS: Record<TeamRole, string[]> = {
  owner: [
    'team:read',
    'team:update',
    'team:delete',
    'team:manage',
    'member:read',
    'member:create',
    'member:update',
    'member:delete',
    'member:manage',
    'invite:read',
    'invite:create',
    'invite:delete',
    'project:read',
    'project:create',
    'project:update',
    'project:delete',
    'project:manage',
    'deployment:read',
    'deployment:create',
    'deployment:update',
    'deployment:delete',
    'deployment:deploy',
    'build:read',
    'build:create',
    'build:delete',
    'env_var:read',
    'env_var:create',
    'env_var:update',
    'env_var:delete',
    'api_token:read',
    'api_token:create',
    'api_token:delete',
  ],
  admin: [
    'team:read',
    'team:update',
    'member:read',
    'member:create',
    'member:update',
    'member:delete',
    'invite:read',
    'invite:create',
    'invite:delete',
    'project:read',
    'project:create',
    'project:update',
    'project:delete',
    'deployment:read',
    'deployment:create',
    'deployment:update',
    'deployment:delete',
    'deployment:deploy',
    'build:read',
    'build:create',
    'build:delete',
    'env_var:read',
    'env_var:create',
    'env_var:update',
    'env_var:delete',
    'api_token:read',
    'api_token:create',
    'api_token:delete',
  ],
  developer: [
    'team:read',
    'member:read',
    'project:read',
    'project:create',
    'project:update',
    'deployment:read',
    'deployment:create',
    'deployment:update',
    'deployment:deploy',
    'build:read',
    'build:create',
    'env_var:read',
    'env_var:create',
    'env_var:update',
    'api_token:read',
    'api_token:create',
  ],
  viewer: ['team:read', 'member:read', 'project:read', 'deployment:read', 'build:read'],
};

export class RbacPG {
  private db: AdminPgDB;

  static readonly MANAGED_TABLES = [TABLES.roles, TABLES.role_assignments] as const;

  constructor(config: PgDomainConfig) {
    const { client, schemaName, skipDefaultIndexes } = resolvePgConfig(config);
    this.db = new AdminPgDB({ client, schemaName, skipDefaultIndexes });
  }

  /**
   * Get all permissions for a user in a team based on their role.
   */
  async getUserPermissionsForTeam(userId: string, teamId: string): Promise<string[]> {
    // Get the user's membership in the team
    const member = await this.db.findOneBy<{ role: TeamRole }>(TABLES.team_members, {
      userId,
      teamId,
    });

    if (!member) {
      return [];
    }

    return ROLE_PERMISSIONS[member.role] || [];
  }

  /**
   * Check if a user has a specific permission in a team.
   */
  async userHasPermission(userId: string, teamId: string, permission: string): Promise<boolean> {
    const permissions = await this.getUserPermissionsForTeam(userId, teamId);
    return permissions.includes(permission);
  }

  /**
   * Check if a user has any of the specified permissions in a team.
   */
  async userHasAnyPermission(userId: string, teamId: string, permissions: string[]): Promise<boolean> {
    const userPermissions = await this.getUserPermissionsForTeam(userId, teamId);
    return permissions.some(p => userPermissions.includes(p));
  }

  /**
   * Check if a user has all of the specified permissions in a team.
   */
  async userHasAllPermissions(userId: string, teamId: string, permissions: string[]): Promise<boolean> {
    const userPermissions = await this.getUserPermissionsForTeam(userId, teamId);
    return permissions.every(p => userPermissions.includes(p));
  }

  /**
   * Get permissions for a role.
   */
  getPermissionsForRole(role: TeamRole): string[] {
    return ROLE_PERMISSIONS[role] || [];
  }
}
