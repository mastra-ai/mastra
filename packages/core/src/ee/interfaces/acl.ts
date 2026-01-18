/**
 * Access Control List (ACL) interfaces for resource-level access control.
 *
 * ACL provides granular, resource-level permissions separate from RBAC.
 * This allows fine-grained control over who can access specific resources.
 *
 * Example:
 * - User A can read Agent #123 but not Agent #456
 * - User B can execute Workflow #789 but not delete it
 */

import type { EEUser } from './user.js';

/**
 * Identifies a specific resource in the system
 */
export interface ResourceIdentifier {
  /**
   * Type of resource (e.g., 'agent', 'workflow', 'tool', 'scorer')
   */
  type: string;

  /**
   * Unique identifier for the resource
   */
  id: string;
}

/**
 * Represents a single ACL grant for a resource
 */
export interface ACLGrant {
  /**
   * Subject who was granted access (user ID, team ID, etc.)
   */
  subject: string;

  /**
   * Resource being granted access to
   */
  resource: ResourceIdentifier;

  /**
   * Actions permitted on the resource (e.g., ['read', 'execute', 'update', 'delete'])
   */
  actions: string[];

  /**
   * When the grant was created
   */
  grantedAt: Date;

  /**
   * Who granted the access (user ID)
   */
  grantedBy: string;
}

/**
 * Read-only ACL provider for checking resource-level permissions.
 *
 * This interface is separate from write operations (grant/revoke) to allow
 * read-only implementations for checking permissions without mutation.
 */
export interface IACLProvider<TUser extends EEUser = EEUser> {
  /**
   * Check if a user can perform an action on a specific resource
   *
   * @param user - User to check permissions for
   * @param resource - Resource identifier
   * @param action - Action to check (e.g., 'read', 'execute', 'delete')
   * @returns true if user has permission, false otherwise
   *
   * @example
   * const canEdit = await acl.canAccess(user, { type: 'agent', id: '123' }, 'update');
   */
  canAccess(user: TUser, resource: ResourceIdentifier, action: string): Promise<boolean>;

  /**
   * List all resource IDs of a given type that the user can access with a specific action
   *
   * @param user - User to check permissions for
   * @param resourceType - Type of resource (e.g., 'agent', 'workflow')
   * @param action - Action to check (e.g., 'read', 'execute')
   * @returns Array of resource IDs the user can access
   *
   * @example
   * const readableAgentIds = await acl.listAccessible(user, 'agent', 'read');
   * // Returns: ['123', '456', '789']
   */
  listAccessible(user: TUser, resourceType: string, action: string): Promise<string[]>;

  /**
   * Filter a list of resources to only those the user can access with a specific action
   *
   * This is useful for batch operations where you want to filter a list of resources
   * down to only those the user has permission to access.
   *
   * @param user - User to check permissions for
   * @param resources - Array of resources to filter
   * @param resourceType - Type of resource
   * @param action - Action to check (e.g., 'read', 'execute')
   * @returns Filtered array of resources the user can access
   *
   * @example
   * const allAgents = [
   *   { id: '123', name: 'Agent 1' },
   *   { id: '456', name: 'Agent 2' },
   *   { id: '789', name: 'Agent 3' }
   * ];
   * const accessible = await acl.filterAccessible(user, allAgents, 'agent', 'read');
   * // Returns only agents user can read
   */
  filterAccessible<T extends { id: string }>(
    user: TUser,
    resources: T[],
    resourceType: string,
    action: string,
  ): Promise<T[]>;
}

/**
 * Optional ACL manager interface for write operations (grant/revoke).
 *
 * Implementations can choose to provide only read access (IACLProvider)
 * or also support write operations (IACLManager).
 */
export interface IACLManager<TUser extends EEUser = EEUser> extends IACLProvider<TUser> {
  /**
   * Grant permissions to a subject for a resource
   *
   * @param subject - Subject to grant permissions to (user ID, team ID, etc.)
   * @param resource - Resource identifier
   * @param actions - Actions to grant (e.g., ['read', 'execute'])
   * @param grantedBy - User ID of who is granting the permissions
   * @returns The created ACL grant
   *
   * @example
   * await acl.grant('user-456', { type: 'agent', id: '123' }, ['read', 'execute'], 'admin-789');
   */
  grant(subject: string, resource: ResourceIdentifier, actions: string[], grantedBy: string): Promise<ACLGrant>;

  /**
   * Revoke permissions from a subject for a resource
   *
   * @param subject - Subject to revoke permissions from
   * @param resource - Resource identifier
   * @param actions - Specific actions to revoke, or undefined to revoke all
   *
   * @example
   * // Revoke specific actions
   * await acl.revoke('user-456', { type: 'agent', id: '123' }, ['delete']);
   *
   * // Revoke all access
   * await acl.revoke('user-456', { type: 'agent', id: '123' });
   */
  revoke(subject: string, resource: ResourceIdentifier, actions?: string[]): Promise<void>;
}
