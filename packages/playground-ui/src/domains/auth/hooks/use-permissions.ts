/**
 * Hook for checking user permissions in the UI.
 *
 * Provides access to the current user's permissions and helper functions
 * to check if the user has specific permissions.
 *
 * @example
 * ```tsx
 * import { usePermissions } from '@mastra/playground-ui';
 *
 * function AgentActions({ agentId }) {
 *   const { hasPermission, hasAnyPermission } = usePermissions();
 *
 *   return (
 *     <>
 *       {hasPermission('agents:execute') && <RunButton agentId={agentId} />}
 *       {hasPermission('agents:write') && <EditButton agentId={agentId} />}
 *       {hasPermission('agents:delete') && <DeleteButton agentId={agentId} />}
 *     </>
 *   );
 * }
 * ```
 */

import { useAuthCapabilities } from './use-auth-capabilities';
import { isAuthenticated } from '../types';

/**
 * Permission matching logic.
 *
 * Supports:
 * - Exact match: 'agents:read' matches 'agents:read'
 * - Wildcard action: 'agents:*' matches 'agents:read', 'agents:write', etc.
 * - Wildcard resource: 'agents:read' matches 'agents:read:specific-id'
 * - Full wildcard: '*' matches everything
 */
function matchesPermission(userPermission: string, requiredPermission: string): boolean {
  // Full wildcard matches everything
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
    if (grantedId === undefined) {
      return true;
    }
    return grantedId === requiredId;
  }

  // Action must match
  if (grantedAction !== requiredAction) {
    return false;
  }

  // No resource ID in granted permission = access to all
  if (grantedId === undefined) {
    return true;
  }

  // Both have resource IDs - must match exactly
  return grantedId === requiredId;
}

/**
 * Check if a user has a specific permission.
 */
function checkHasPermission(userPermissions: string[], requiredPermission: string): boolean {
  return userPermissions.some(p => matchesPermission(p, requiredPermission));
}

export type UsePermissionsResult = {
  /** User's roles from the auth provider */
  roles: string[];
  /** User's resolved permissions */
  permissions: string[];
  /** Whether permissions are being loaded */
  isLoading: boolean;
  /** Whether the user is authenticated */
  isAuthenticated: boolean;
  /** Whether RBAC is enabled (if false, all permission checks return true) */
  rbacEnabled: boolean;
  /** Check if user has a specific permission (returns true if RBAC disabled) */
  hasPermission: (permission: string) => boolean;
  /** Check if user has ALL of the specified permissions (returns true if RBAC disabled) */
  hasAllPermissions: (permissions: string[]) => boolean;
  /** Check if user has ANY of the specified permissions (returns true if RBAC disabled) */
  hasAnyPermission: (permissions: string[]) => boolean;
  /** Check if user has a specific role (returns true if RBAC disabled) */
  hasRole: (role: string) => boolean;
  /** Check if user can edit (has write permission for the resource, or RBAC disabled) */
  canEdit: (resource: string) => boolean;
  /** Check if user can delete (has delete permission for the resource, or RBAC disabled) */
  canDelete: (resource: string) => boolean;
  /** Check if user can execute (has execute permission for the resource, or RBAC disabled) */
  canExecute: (resource: string) => boolean;
};

/**
 * Hook for checking user permissions.
 *
 * Returns the user's roles and permissions from the auth capabilities,
 * along with helper functions to check permissions.
 *
 * **Important:** If RBAC is not enabled (no rbac provider configured),
 * all permission checks will return `true`, allowing unrestricted access.
 *
 * @returns Permission checking utilities
 */
export function usePermissions(): UsePermissionsResult {
  const { data: capabilities, isLoading } = useAuthCapabilities();

  // Extract roles and permissions from capabilities
  const authenticated = capabilities && isAuthenticated(capabilities);
  const access = authenticated ? capabilities.access : null;

  // Check if RBAC is enabled
  // If RBAC capability is false or not present, all permission checks should return true
  const rbacEnabled = authenticated ? capabilities.capabilities.rbac : false;

  const roles = access?.roles ?? [];
  const permissions = access?.permissions ?? [];

  // Helper to check permission with RBAC bypass
  const checkPermission = (permission: string): boolean => {
    // If RBAC is not enabled, allow everything
    if (!rbacEnabled) return true;
    return checkHasPermission(permissions, permission);
  };

  return {
    roles,
    permissions,
    isLoading,
    isAuthenticated: !!authenticated,
    rbacEnabled,

    hasPermission: (permission: string) => {
      return checkPermission(permission);
    },

    hasAllPermissions: (requiredPermissions: string[]) => {
      if (!rbacEnabled) return true;
      return requiredPermissions.every(p => checkHasPermission(permissions, p));
    },

    hasAnyPermission: (requiredPermissions: string[]) => {
      if (!rbacEnabled) return true;
      return requiredPermissions.some(p => checkHasPermission(permissions, p));
    },

    hasRole: (role: string) => {
      if (!rbacEnabled) return true;
      return roles.includes(role);
    },

    // Convenience methods for common permission patterns
    canEdit: (resource: string) => {
      return checkPermission(`${resource}:write`);
    },

    canDelete: (resource: string) => {
      return checkPermission(`${resource}:delete`);
    },

    canExecute: (resource: string) => {
      return checkPermission(`${resource}:execute`);
    },
  };
}
