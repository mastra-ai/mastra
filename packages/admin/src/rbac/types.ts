/**
 * RBAC resource types.
 */
export const RBACResource = {
  TEAM: 'team',
  PROJECT: 'project',
  DEPLOYMENT: 'deployment',
  BUILD: 'build',
  ENV_VAR: 'env_var',
  MEMBER: 'member',
  INVITE: 'invite',
  API_TOKEN: 'api_token',
} as const;

export type RBACResource = (typeof RBACResource)[keyof typeof RBACResource];

/**
 * RBAC action types.
 */
export const RBACAction = {
  CREATE: 'create',
  READ: 'read',
  UPDATE: 'update',
  DELETE: 'delete',
  DEPLOY: 'deploy',
  MANAGE: 'manage',
} as const;

export type RBACAction = (typeof RBACAction)[keyof typeof RBACAction];

/**
 * Permission string format: "resource:action"
 */
export type Permission = `${RBACResource}:${RBACAction}`;

/**
 * Role definition with permissions.
 */
export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
  isSystem: boolean;
}

/**
 * Context for permission checks.
 */
export interface PermissionContext {
  userId: string;
  teamId: string;
  projectId?: string;
  deploymentId?: string;
}
