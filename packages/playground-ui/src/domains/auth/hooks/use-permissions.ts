import { useAuthCapabilities } from './use-auth-capabilities.js';
import { isAuthenticated } from '../types.js';

/**
 * Hook for checking user permissions.
 *
 * Provides permission checking functions that work with the RBAC system.
 * Returns permission check functions that default to false when not authenticated.
 *
 * @example
 * ```tsx
 * function AgentEditor() {
 *   const { hasPermission, hasAnyPermission } = usePermissions();
 *
 *   const canEdit = hasPermission('agents:write');
 *   const canView = hasAnyPermission(['agents:read', 'agents:*']);
 *
 *   if (!canEdit) {
 *     return <div>Access denied</div>;
 *   }
 *
 *   return <Editor />;
 * }
 * ```
 */
export function usePermissions() {
  const { data: capabilities, isLoading } = useAuthCapabilities();

  // Extract permissions array from capabilities if authenticated
  const permissions =
    capabilities && isAuthenticated(capabilities) && capabilities.access ? capabilities.access.permissions : [];

  /**
   * Check if user has a specific permission.
   *
   * Supports wildcard matching:
   * - '*' matches any permission
   * - 'agents:*' matches 'agents:read', 'agents:write', etc.
   * - 'agents:read' only matches 'agents:read'
   *
   * @param permission - Permission string to check (e.g., 'agents:read')
   * @returns true if user has permission, false otherwise
   */
  const hasPermission = (permission: string): boolean => {
    if (!permissions.length) return false;

    // Check for exact match
    if (permissions.includes(permission)) return true;

    // Check for wildcard permissions
    if (permissions.includes('*')) return true;

    // Check for namespace wildcard (e.g., 'agents:*' matches 'agents:read')
    const [namespace] = permission.split(':');
    if (namespace && permissions.includes(`${namespace}:*`)) return true;

    return false;
  };

  /**
   * Check if user has at least one of the specified permissions (OR).
   *
   * @param perms - Array of permission strings to check
   * @returns true if user has any of the permissions, false otherwise
   */
  const hasAnyPermission = (perms: string[]): boolean => {
    return perms.some(perm => hasPermission(perm));
  };

  /**
   * Check if user has all of the specified permissions (AND).
   *
   * @param perms - Array of permission strings to check
   * @returns true if user has all permissions, false otherwise
   */
  const hasAllPermissions = (perms: string[]): boolean => {
    return perms.every(perm => hasPermission(perm));
  };

  return {
    /** Array of user's permissions */
    permissions,
    /** Check if user has a specific permission */
    hasPermission,
    /** Check if user has any of the specified permissions */
    hasAnyPermission,
    /** Check if user has all of the specified permissions */
    hasAllPermissions,
    /** Whether permissions are currently loading */
    isLoading,
  };
}
