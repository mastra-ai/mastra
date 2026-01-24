import { RBACAction, RBACResource   } from './types';
import type {Permission, Role} from './types';

/**
 * Helper to create permission strings.
 */
function p(resource: RBACResource, action: RBACAction): Permission {
  return `${resource}:${action}`;
}

/**
 * All possible permissions.
 */
export const ALL_PERMISSIONS: Permission[] = Object.values(RBACResource).flatMap((resource) =>
  Object.values(RBACAction).map((action) => p(resource, action)),
);

/**
 * System-defined roles.
 */
export const SYSTEM_ROLES: Record<string, Role> = {
  owner: {
    id: 'owner',
    name: 'Owner',
    description: 'Full access to all team resources',
    permissions: ALL_PERMISSIONS,
    isSystem: true,
  },
  admin: {
    id: 'admin',
    name: 'Admin',
    description: 'Manage team settings, projects, and members',
    permissions: [
      // Team management (except delete)
      p(RBACResource.TEAM, RBACAction.READ),
      p(RBACResource.TEAM, RBACAction.UPDATE),
      // Member management
      p(RBACResource.MEMBER, RBACAction.CREATE),
      p(RBACResource.MEMBER, RBACAction.READ),
      p(RBACResource.MEMBER, RBACAction.UPDATE),
      p(RBACResource.MEMBER, RBACAction.DELETE),
      // Invite management
      p(RBACResource.INVITE, RBACAction.CREATE),
      p(RBACResource.INVITE, RBACAction.READ),
      p(RBACResource.INVITE, RBACAction.DELETE),
      // Full project management
      p(RBACResource.PROJECT, RBACAction.CREATE),
      p(RBACResource.PROJECT, RBACAction.READ),
      p(RBACResource.PROJECT, RBACAction.UPDATE),
      p(RBACResource.PROJECT, RBACAction.DELETE),
      // Full deployment management
      p(RBACResource.DEPLOYMENT, RBACAction.CREATE),
      p(RBACResource.DEPLOYMENT, RBACAction.READ),
      p(RBACResource.DEPLOYMENT, RBACAction.UPDATE),
      p(RBACResource.DEPLOYMENT, RBACAction.DELETE),
      p(RBACResource.DEPLOYMENT, RBACAction.DEPLOY),
      // Build management
      p(RBACResource.BUILD, RBACAction.CREATE),
      p(RBACResource.BUILD, RBACAction.READ),
      p(RBACResource.BUILD, RBACAction.DELETE),
      // Env var management
      p(RBACResource.ENV_VAR, RBACAction.CREATE),
      p(RBACResource.ENV_VAR, RBACAction.READ),
      p(RBACResource.ENV_VAR, RBACAction.UPDATE),
      p(RBACResource.ENV_VAR, RBACAction.DELETE),
      // API token management
      p(RBACResource.API_TOKEN, RBACAction.CREATE),
      p(RBACResource.API_TOKEN, RBACAction.READ),
      p(RBACResource.API_TOKEN, RBACAction.DELETE),
    ],
    isSystem: true,
  },
  developer: {
    id: 'developer',
    name: 'Developer',
    description: 'Deploy and manage projects',
    permissions: [
      // Read team
      p(RBACResource.TEAM, RBACAction.READ),
      p(RBACResource.MEMBER, RBACAction.READ),
      // Project management (no delete)
      p(RBACResource.PROJECT, RBACAction.CREATE),
      p(RBACResource.PROJECT, RBACAction.READ),
      p(RBACResource.PROJECT, RBACAction.UPDATE),
      // Deployment management
      p(RBACResource.DEPLOYMENT, RBACAction.CREATE),
      p(RBACResource.DEPLOYMENT, RBACAction.READ),
      p(RBACResource.DEPLOYMENT, RBACAction.UPDATE),
      p(RBACResource.DEPLOYMENT, RBACAction.DEPLOY),
      // Build management
      p(RBACResource.BUILD, RBACAction.CREATE),
      p(RBACResource.BUILD, RBACAction.READ),
      // Env var management
      p(RBACResource.ENV_VAR, RBACAction.CREATE),
      p(RBACResource.ENV_VAR, RBACAction.READ),
      p(RBACResource.ENV_VAR, RBACAction.UPDATE),
      // Own API tokens
      p(RBACResource.API_TOKEN, RBACAction.CREATE),
      p(RBACResource.API_TOKEN, RBACAction.READ),
    ],
    isSystem: true,
  },
  viewer: {
    id: 'viewer',
    name: 'Viewer',
    description: 'Read-only access to projects',
    permissions: [
      p(RBACResource.TEAM, RBACAction.READ),
      p(RBACResource.MEMBER, RBACAction.READ),
      p(RBACResource.PROJECT, RBACAction.READ),
      p(RBACResource.DEPLOYMENT, RBACAction.READ),
      p(RBACResource.BUILD, RBACAction.READ),
      // Note: No env var read (secrets)
    ],
    isSystem: true,
  },
};

/**
 * Get role by ID.
 */
export function getSystemRole(roleId: string): Role | undefined {
  return SYSTEM_ROLES[roleId];
}

/**
 * Check if a role has a permission.
 */
export function roleHasPermission(role: Role, permission: Permission): boolean {
  return role.permissions.includes(permission);
}
