/**
 * Default roles and permissions for Mastra Studio.
 */

import type { RoleDefinition, RoleMapping } from '../interfaces';

// Re-export RoleMapping for backward compatibility
export type { RoleMapping };

/**
 * Default role definitions for Studio.
 *
 * These roles provide a sensible starting point for most applications:
 * - **owner**: Full access to everything
 * - **admin**: Manage agents, workflows, and users
 * - **member**: Execute agents and workflows, read-only settings
 * - **viewer**: Read-only access
 */
export const DEFAULT_ROLES: RoleDefinition[] = [
  {
    id: 'owner',
    name: 'Owner',
    description: 'Full access to all features and settings',
    permissions: ['*'],
  },
  {
    id: 'admin',
    name: 'Admin',
    description: 'Manage agents, workflows, and team members',
    permissions: [
      'studio:*',
      'agents:*',
      'workflows:*',
      'memory:*',
      'tools:*',
      'logs:read',
      'users:read',
      'users:invite',
      'settings:read',
      'settings:write',
    ],
  },
  {
    id: 'member',
    name: 'Member',
    description: 'Execute agents and workflows',
    permissions: [
      'studio:read',
      'studio:execute',
      'agents:read',
      'agents:execute',
      'workflows:read',
      'workflows:execute',
      'memory:read',
      'tools:read',
      'logs:read',
    ],
  },
  {
    id: 'viewer',
    name: 'Viewer',
    description: 'Read-only access to agents and workflows',
    permissions: ['studio:read', 'agents:read', 'workflows:read', 'logs:read'],
  },
];

/**
 * All available Studio permissions.
 *
 * Permission format: `{resource}:{action}`
 *
 * Resources:
 * - studio: General Studio access
 * - agents: Agent management
 * - workflows: Workflow management
 * - memory: Memory/thread access
 * - tools: Tool management
 * - logs: Log viewing
 * - users: User management
 * - settings: Settings access
 *
 * Actions:
 * - read: View resource
 * - write: Create/update resource
 * - execute: Run/execute resource
 * - delete: Delete resource
 * - admin: Administrative actions
 */
export const STUDIO_PERMISSIONS = [
  // Studio
  'studio:read',
  'studio:write',
  'studio:execute',
  'studio:admin',

  // Agents
  'agents:read',
  'agents:write',
  'agents:execute',
  'agents:delete',

  // Workflows
  'workflows:read',
  'workflows:write',
  'workflows:execute',
  'workflows:delete',

  // Memory
  'memory:read',
  'memory:write',
  'memory:delete',

  // Tools
  'tools:read',
  'tools:write',
  'tools:delete',

  // Logs
  'logs:read',
  'logs:delete',

  // Users
  'users:read',
  'users:write',
  'users:invite',
  'users:delete',

  // Settings
  'settings:read',
  'settings:write',
] as const;

/**
 * Type for valid Studio permissions.
 */
export type StudioPermission = (typeof STUDIO_PERMISSIONS)[number];

/**
 * Get role by ID from default roles.
 *
 * @param roleId - Role ID to find
 * @returns Role definition or undefined
 */
export function getDefaultRole(roleId: string): RoleDefinition | undefined {
  return DEFAULT_ROLES.find(role => role.id === roleId);
}

/**
 * Resolve all permissions for a set of role IDs.
 *
 * Handles role inheritance and deduplication.
 *
 * @param roleIds - Role IDs to resolve
 * @param roles - Role definitions (defaults to DEFAULT_ROLES)
 * @returns Array of resolved permissions
 */
export function resolvePermissions(roleIds: string[], roles: RoleDefinition[] = DEFAULT_ROLES): string[] {
  const permissions = new Set<string>();
  const visited = new Set<string>();

  function resolveRole(roleId: string) {
    if (visited.has(roleId)) return;
    visited.add(roleId);

    const role = roles.find(r => r.id === roleId);
    if (!role) return;

    // Add permissions from this role
    for (const permission of role.permissions) {
      permissions.add(permission);
    }

    // Resolve inherited roles
    if (role.inherits) {
      for (const inheritedRoleId of role.inherits) {
        resolveRole(inheritedRoleId);
      }
    }
  }

  for (const roleId of roleIds) {
    resolveRole(roleId);
  }

  return Array.from(permissions);
}

/**
 * Check if a permission matches (including wildcard support).
 *
 * Permission format: `{resource}:{action}[:{resource-id}]`
 *
 * Examples:
 * - `*` matches everything
 * - `agents:*` matches `agents:read`, `agents:read:my-agent`
 * - `agents:read` matches `agents:read`, `agents:read:my-agent`
 * - `agents:read:my-agent` matches only `agents:read:my-agent`
 * - `agents:*:my-agent` matches `agents:read:my-agent`, `agents:write:my-agent`
 *
 * @param userPermission - Permission the user has
 * @param requiredPermission - Permission being checked
 * @returns True if permission matches
 */
export function matchesPermission(userPermission: string, requiredPermission: string): boolean {
  // Wildcard matches everything
  if (userPermission === '*') {
    return true;
  }

  const grantedParts = userPermission.split(':');
  const requiredParts = requiredPermission.split(':');

  // Must have at least resource:action
  if (grantedParts.length < 2 || requiredParts.length < 2) {
    return userPermission === requiredPermission;
  }

  const [grantedResource, grantedAction, grantedId] = grantedParts;
  const [requiredResource, requiredAction, requiredId] = requiredParts;

  // Resource must match
  if (grantedResource !== requiredResource) {
    return false;
  }

  // Action wildcard: "agents:*" matches any action
  if (grantedAction === '*') {
    // If no granted ID, matches all resources
    // If granted ID specified (agents:*:my-agent), must match required ID
    if (grantedId === undefined) {
      return true;
    }
    // agents:*:my-agent matches agents:read:my-agent but not agents:read:other
    return grantedId === requiredId;
  }

  // Action must match
  if (grantedAction !== requiredAction) {
    return false;
  }

  // No resource ID in granted permission = access to all resources of this type
  // "agents:read" matches "agents:read" and "agents:read:specific-id"
  if (grantedId === undefined) {
    return true;
  }

  // Both have resource IDs - must match exactly
  return grantedId === requiredId;
}

/**
 * Check if a user has a specific permission.
 *
 * @param userPermissions - Permissions the user has
 * @param requiredPermission - Permission being checked
 * @returns True if user has the permission
 */
export function hasPermission(userPermissions: string[], requiredPermission: string): boolean {
  return userPermissions.some(p => matchesPermission(p, requiredPermission));
}

/**
 * Resolve permissions from user roles using a role mapping.
 *
 * This function translates provider-defined roles (from WorkOS, Okta, etc.)
 * to Mastra permissions using a configurable mapping.
 *
 * @example
 * ```typescript
 * const roleMapping = {
 *   "Engineering": ["agents:*", "workflows:*"],
 *   "Product": ["agents:read"],
 *   "_default": [],
 * };
 *
 * // User has "Engineering" and "QA" roles
 * const permissions = resolvePermissionsFromMapping(
 *   ["Engineering", "QA"],
 *   roleMapping
 * );
 * // Result: ["agents:*", "workflows:*"] (QA is unmapped, gets _default)
 * ```
 *
 * @param roles - User's roles from the identity provider
 * @param mapping - Role to permission mapping
 * @returns Array of resolved permissions
 */
export function resolvePermissionsFromMapping(roles: string[], mapping: RoleMapping): string[] {
  const permissions = new Set<string>();
  const defaultPerms = mapping['_default'] ?? [];

  for (const role of roles) {
    const rolePerms = mapping[role];
    if (rolePerms) {
      for (const perm of rolePerms) {
        permissions.add(perm);
      }
    } else {
      // Apply default permissions for unmapped roles
      for (const perm of defaultPerms) {
        permissions.add(perm);
      }
    }
  }

  return Array.from(permissions);
}
