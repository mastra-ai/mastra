/**
 * ACL provider interface for EE authentication.
 * Enables resource-level access control in Studio.
 */

/**
 * Identifier for a resource.
 */
export interface ResourceIdentifier {
  /** Resource type (e.g., 'agent', 'workflow', 'thread') */
  type: string;
  /** Resource ID */
  id: string;
}

/**
 * An access control grant.
 */
export interface ACLGrant {
  /** Subject of the grant (user or role) */
  subject: {
    type: 'user' | 'role';
    id: string;
  };
  /** Resource the grant applies to */
  resource: ResourceIdentifier;
  /** Actions granted */
  actions: string[];
  /** When the grant was created */
  grantedAt: Date;
  /** Who created the grant */
  grantedBy?: string;
}

/**
 * Provider interface for access control lists (read-only).
 *
 * Implement this interface to enable:
 * - Resource-level permission checks
 * - Filtered resource lists based on access
 * - ACL display in resource settings
 *
 * @example
 * ```typescript
 * class DatabaseACLProvider implements IACLProvider {
 *   async canAccess(user, resource, action) {
 *     const grants = await this.db.query(
 *       `SELECT * FROM acl_grants
 *        WHERE (subject_type = 'user' AND subject_id = $1)
 *           OR (subject_type = 'role' AND subject_id = ANY($2))
 *        AND resource_type = $3 AND resource_id = $4
 *        AND $5 = ANY(actions)`,
 *       [user.id, user.roles, resource.type, resource.id, action]
 *     );
 *     return grants.length > 0;
 *   }
 *
 *   async filterAccessible(user, resources, resourceType, action) {
 *     const accessible = await this.listAccessible(user, resourceType, action);
 *     return resources.filter(r => accessible.includes(r.id));
 *   }
 * }
 * ```
 */
export interface IACLProvider<TUser = unknown> {
  /**
   * Check if user can perform action on resource.
   *
   * @param user - User making the request
   * @param resource - Resource to check access for
   * @param action - Action to check (e.g., 'read', 'write', 'execute', 'delete')
   * @returns True if access is granted
   */
  canAccess(user: TUser, resource: ResourceIdentifier, action: string): Promise<boolean>;

  /**
   * Get list of resource IDs user can access.
   *
   * @param user - User to check access for
   * @param resourceType - Type of resources to list
   * @param action - Action to filter by
   * @returns Array of accessible resource IDs
   */
  listAccessible(user: TUser, resourceType: string, action: string): Promise<string[]>;

  /**
   * Filter array of resources to only those user can access.
   *
   * @param user - User to check access for
   * @param resources - Resources to filter
   * @param resourceType - Type of the resources
   * @param action - Action to filter by
   * @returns Filtered array of accessible resources
   */
  filterAccessible<T extends { id: string }>(
    user: TUser,
    resources: T[],
    resourceType: string,
    action: string,
  ): Promise<T[]>;
}

/**
 * Extended interface for managing ACLs (write operations).
 *
 * Implement this in addition to IACLProvider to enable ACL management.
 */
export interface IACLManager<TUser = unknown> extends IACLProvider<TUser> {
  /**
   * Grant access to a resource.
   *
   * @param subject - User or role to grant access to
   * @param resource - Resource to grant access to
   * @param actions - Actions to grant
   */
  grant(subject: { type: 'user' | 'role'; id: string }, resource: ResourceIdentifier, actions: string[]): Promise<void>;

  /**
   * Revoke access to a resource.
   *
   * @param subject - User or role to revoke access from
   * @param resource - Resource to revoke access to
   * @param actions - Actions to revoke (omit to revoke all)
   */
  revoke(
    subject: { type: 'user' | 'role'; id: string },
    resource: ResourceIdentifier,
    actions?: string[],
  ): Promise<void>;

  /**
   * List all grants for a resource.
   *
   * @param resource - Resource to list grants for
   * @returns Array of grants
   */
  listGrants(resource: ResourceIdentifier): Promise<ACLGrant[]>;

  /**
   * List all grants for a subject.
   *
   * @param subject - User or role to list grants for
   * @returns Array of grants
   */
  listGrantsForSubject(subject: { type: 'user' | 'role'; id: string }): Promise<ACLGrant[]>;
}
