/**
 * WorkOS RBAC provider for Mastra.
 *
 * Integrates WorkOS organization memberships and roles with Mastra's
 * permission-based access control system.
 */

import type { IRBACProvider, RoleMapping } from '@mastra/core/ee';
import { resolvePermissionsFromMapping, matchesPermission } from '@mastra/core/ee';
import { WorkOS } from '@workos-inc/node';
import { LRUCache } from 'lru-cache';

import type { WorkOSUser, MastraRBACWorkosOptions } from './types';

/**
 * WorkOS RBAC provider that maps organization roles to Mastra permissions.
 *
 * This provider fetches organization memberships from WorkOS and translates
 * role slugs into Mastra permissions using a configurable role mapping.
 *
 * @example Basic usage
 * ```typescript
 * import { MastraRBACWorkos } from '@mastra/auth-workos';
 *
 * const rbac = new MastraRBACWorkos({
 *   apiKey: process.env.WORKOS_API_KEY,
 *   clientId: process.env.WORKOS_CLIENT_ID,
 *   roleMapping: {
 *     admin: ['*'],
 *     member: ['agents:read', 'workflows:*'],
 *     viewer: ['agents:read', 'workflows:read'],
 *     _default: [],
 *   },
 * });
 * ```
 *
 * @example With specific organization
 * ```typescript
 * const rbac = new MastraRBACWorkos({
 *   apiKey: process.env.WORKOS_API_KEY,
 *   clientId: process.env.WORKOS_CLIENT_ID,
 *   organizationId: 'org_123456',
 *   roleMapping: {
 *     admin: ['*'],
 *     member: ['agents:*'],
 *   },
 * });
 * ```
 */
/** Default cache TTL in milliseconds (60 seconds) */
const DEFAULT_CACHE_TTL_MS = 60 * 1000;

/** Default max cache size (number of users) */
const DEFAULT_CACHE_MAX_SIZE = 1000;

export class MastraRBACWorkos implements IRBACProvider<WorkOSUser> {
  private workos: WorkOS;
  private options: MastraRBACWorkosOptions;
  private permissionCache: LRUCache<string, string[]>;

  /**
   * Expose roleMapping for middleware access.
   * This allows the authorization middleware to resolve permissions
   * without needing to call the async methods.
   */
  get roleMapping(): RoleMapping {
    return this.options.roleMapping;
  }

  /**
   * Create a new WorkOS RBAC provider.
   *
   * @param options - RBAC configuration options
   */
  constructor(options: MastraRBACWorkosOptions) {
    const apiKey = options.apiKey ?? process.env.WORKOS_API_KEY;
    const clientId = options.clientId ?? process.env.WORKOS_CLIENT_ID;

    if (!apiKey || !clientId) {
      throw new Error(
        'WorkOS API key and client ID are required. ' +
          'Provide them in the options or set WORKOS_API_KEY and WORKOS_CLIENT_ID environment variables.',
      );
    }

    this.workos = new WorkOS(apiKey, { clientId });
    this.options = options;

    // Initialize LRU cache with configurable size and TTL
    this.permissionCache = new LRUCache<string, string[]>({
      max: options.cache?.maxSize ?? DEFAULT_CACHE_MAX_SIZE,
      ttl: options.cache?.ttlMs ?? DEFAULT_CACHE_TTL_MS,
    });

    console.info(
      `[WorkOS RBAC] Initialized with roleMapping keys: ${Object.keys(this.options.roleMapping).join(', ')}`,
    );
  }

  /**
   * Get all roles for a user from their WorkOS organization memberships.
   *
   * Fetches organization memberships from WorkOS and extracts role slugs.
   * If an organizationId is configured, only returns roles from that organization.
   * Otherwise, returns roles from all organizations the user belongs to.
   *
   * @param user - WorkOS user to get roles for
   * @returns Array of role slugs
   */
  async getRoles(user: WorkOSUser): Promise<string[]> {
    console.info(`[WorkOS RBAC] getRoles called for user ${user.id}, workosId=${user.workosId}`);

    // If memberships are already present on the user object, use them
    if (user.memberships && user.memberships.length > 0) {
      const roles = this.extractRolesFromMemberships(user);
      console.info(`[WorkOS RBAC] Using cached memberships, roles: ${JSON.stringify(roles)}`);
      return roles;
    }

    // Fetch memberships from WorkOS
    try {
      console.info(`[WorkOS RBAC] Fetching memberships from WorkOS for user ${user.workosId}`);
      const memberships = await this.workos.userManagement.listOrganizationMemberships({
        userId: user.workosId,
      });
      console.info(`[WorkOS RBAC] Found ${memberships.data.length} memberships`);

      // Filter by organization if specified
      const relevantMemberships = this.options.organizationId
        ? memberships.data.filter(m => m.organizationId === this.options.organizationId)
        : memberships.data;

      // Extract role slugs
      const roles = relevantMemberships.map(m => m.role.slug);
      console.info(`[WorkOS RBAC] Extracted roles: ${JSON.stringify(roles)}`);
      return roles;
    } catch (error) {
      console.error(`[WorkOS RBAC] Error fetching memberships:`, error);
      // Return empty roles on error - _default permissions will be applied
      return [];
    }
  }

  /**
   * Check if a user has a specific role.
   *
   * @param user - WorkOS user to check
   * @param role - Role slug to check for
   * @returns True if user has the role
   */
  async hasRole(user: WorkOSUser, role: string): Promise<boolean> {
    const roles = await this.getRoles(user);
    return roles.includes(role);
  }

  /**
   * Get all permissions for a user by mapping their WorkOS roles.
   *
   * Uses the configured roleMapping to translate WorkOS role slugs
   * into Mastra permission strings. Results are cached by user ID
   * for performance.
   *
   * If the user has no roles (no organization memberships), the
   * _default permissions from the role mapping are applied.
   *
   * @param user - WorkOS user to get permissions for
   * @returns Array of permission strings
   */
  async getPermissions(user: WorkOSUser): Promise<string[]> {
    console.info(`[WorkOS RBAC] getPermissions called for user ${user.id}`);

    // Check cache first (LRU cache handles TTL automatically)
    const cached = this.permissionCache.get(user.id);
    if (cached) {
      console.info(`[WorkOS RBAC] Returning cached permissions: ${JSON.stringify(cached)}`);
      return cached;
    }

    // Get roles and resolve permissions
    const roles = await this.getRoles(user);

    let permissions: string[];
    if (roles.length === 0) {
      // No roles - apply _default permissions
      permissions = this.options.roleMapping['_default'] ?? [];
      console.info(`[WorkOS RBAC] No roles, using _default permissions: ${JSON.stringify(permissions)}`);
    } else {
      permissions = resolvePermissionsFromMapping(roles, this.options.roleMapping);
      console.info(`[WorkOS RBAC] Resolved permissions from roles: ${JSON.stringify(permissions)}`);
    }

    // Cache the result (LRU cache handles TTL and eviction)
    this.permissionCache.set(user.id, permissions);

    return permissions;
  }

  /**
   * Check if a user has a specific permission.
   *
   * Uses wildcard matching to check if any of the user's permissions
   * grant access to the required permission.
   *
   * @param user - WorkOS user to check
   * @param permission - Permission to check for (e.g., 'agents:read')
   * @returns True if user has the permission
   */
  async hasPermission(user: WorkOSUser, permission: string): Promise<boolean> {
    const permissions = await this.getPermissions(user);
    return permissions.some(p => matchesPermission(p, permission));
  }

  /**
   * Check if a user has ALL of the specified permissions.
   *
   * @param user - WorkOS user to check
   * @param permissions - Array of permissions to check for
   * @returns True if user has all permissions
   */
  async hasAllPermissions(user: WorkOSUser, permissions: string[]): Promise<boolean> {
    const userPermissions = await this.getPermissions(user);
    return permissions.every(required => userPermissions.some(p => matchesPermission(p, required)));
  }

  /**
   * Check if a user has ANY of the specified permissions.
   *
   * @param user - WorkOS user to check
   * @param permissions - Array of permissions to check for
   * @returns True if user has at least one permission
   */
  async hasAnyPermission(user: WorkOSUser, permissions: string[]): Promise<boolean> {
    const userPermissions = await this.getPermissions(user);
    return permissions.some(required => userPermissions.some(p => matchesPermission(p, required)));
  }

  /**
   * Clear the entire permission cache.
   *
   * Call this when system-wide role changes occur.
   * For individual user changes, prefer clearUserCache() instead.
   */
  clearCache(): void {
    this.permissionCache.clear();
  }

  /**
   * Clear cached permissions for a specific user.
   *
   * Call this when a user's roles change to ensure fresh permission resolution
   * on their next request. This is more efficient than clearing the entire cache.
   *
   * @param userId - The user ID to clear from cache
   */
  clearUserCache(userId: string): void {
    this.permissionCache.delete(userId);
  }

  /**
   * Get cache statistics for monitoring.
   *
   * @returns Object with cache size and max size
   */
  getCacheStats(): { size: number; maxSize: number } {
    return {
      size: this.permissionCache.size,
      maxSize: this.permissionCache.max,
    };
  }

  /**
   * Extract role slugs from memberships attached to the user object.
   *
   * @param user - WorkOS user with memberships
   * @returns Array of role slugs
   */
  private extractRolesFromMemberships(user: WorkOSUser): string[] {
    if (!user.memberships) {
      return [];
    }

    // Filter by organization if specified
    const relevantMemberships = this.options.organizationId
      ? user.memberships.filter(m => m.organizationId === this.options.organizationId)
      : user.memberships;

    return relevantMemberships.map(m => m.role.slug);
  }
}
