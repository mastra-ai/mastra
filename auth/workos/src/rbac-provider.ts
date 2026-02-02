/**
 * WorkOS RBAC provider for Mastra.
 *
 * Integrates WorkOS organization memberships and roles with Mastra's
 * permission-based access control system.
 */

import type { IRBACProvider, RoleMapping } from '@mastra/core/auth';
import { resolvePermissionsFromMapping, matchesPermission } from '@mastra/core/auth';
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
  /**
   * Caches storing promises for both roles and permissions.
   * Storing promises handles both caching and concurrent request deduplication:
   * - Cache hit: returns resolved promise immediately
   * - Cache miss: creates promise, caches it, all concurrent requests share it
   */
  private rolesCache: LRUCache<string, Promise<string[]>>;
  private permissionCache: LRUCache<string, Promise<string[]>>;

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

    // Initialize LRU caches with configurable size and TTL
    const cacheOptions = {
      max: options.cache?.maxSize ?? DEFAULT_CACHE_MAX_SIZE,
      ttl: options.cache?.ttlMs ?? DEFAULT_CACHE_TTL_MS,
    };
    this.rolesCache = new LRUCache<string, Promise<string[]>>(cacheOptions);
    this.permissionCache = new LRUCache<string, Promise<string[]>>(cacheOptions);

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
    // If memberships are already present on the user object, use them
    if (user.memberships && user.memberships.length > 0) {
      const roles = this.extractRolesFromMemberships(user);
      console.info(`[WorkOS RBAC] Using user memberships, roles: ${JSON.stringify(roles)}`);
      return roles;
    }

    const cacheKey = user.workosId ?? user.id;

    // Check cache - returns existing promise (resolved or in-flight)
    const cached = this.rolesCache.get(cacheKey);
    if (cached) {
      console.info(`[WorkOS RBAC] Roles cache hit for user ${cacheKey}`);
      return cached;
    }

    // Create and cache the role fetch promise
    console.info(`[WorkOS RBAC] Roles cache miss for user ${cacheKey}, fetching from WorkOS`);
    const rolesPromise = this.fetchRolesFromWorkOS(user);
    this.rolesCache.set(cacheKey, rolesPromise);

    return rolesPromise;
  }

  /**
   * Fetch roles from WorkOS API.
   */
  private async fetchRolesFromWorkOS(user: WorkOSUser): Promise<string[]> {
    try {
      console.info(`[WorkOS RBAC] Fetching memberships from WorkOS API for user ${user.workosId}`);
      const memberships = await this.workos.userManagement.listOrganizationMemberships({
        userId: user.workosId,
      });

      // Filter by organization if specified
      const relevantMemberships = this.options.organizationId
        ? memberships.data.filter(m => m.organizationId === this.options.organizationId)
        : memberships.data;

      // Extract role slugs
      const roles = relevantMemberships.map(m => m.role.slug);
      console.info(`[WorkOS RBAC] Fetched ${memberships.data.length} memberships, roles: ${JSON.stringify(roles)}`);
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
   * for performance, and concurrent requests are deduplicated.
   *
   * If the user has no roles (no organization memberships), the
   * _default permissions from the role mapping are applied.
   *
   * @param user - WorkOS user to get permissions for
   * @returns Array of permission strings
   */
  async getPermissions(user: WorkOSUser): Promise<string[]> {
    const cacheKey = user.id;

    // Check cache - returns existing promise (resolved or in-flight)
    const cached = this.permissionCache.get(cacheKey);
    if (cached) {
      console.info(`[WorkOS RBAC] Cache hit for user ${cacheKey}`);
      return cached;
    }

    // Create and cache the permission resolution promise
    // All concurrent requests will share this same promise
    console.info(`[WorkOS RBAC] Cache miss for user ${cacheKey}, fetching permissions`);
    const permissionPromise = this.resolveUserPermissions(user);
    this.permissionCache.set(cacheKey, permissionPromise);

    return permissionPromise;
  }

  /**
   * Resolve permissions for a user by fetching roles and mapping them.
   */
  private async resolveUserPermissions(user: WorkOSUser): Promise<string[]> {
    const roles = await this.getRoles(user);

    let permissions: string[];
    if (roles.length === 0) {
      // No roles - apply _default permissions
      permissions = this.options.roleMapping['_default'] ?? [];
    } else {
      permissions = resolvePermissionsFromMapping(roles, this.options.roleMapping);
    }

    console.info(`[WorkOS RBAC] Resolved permissions for user ${user.id}: ${JSON.stringify(permissions)}`);
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
   * Clear all caches.
   *
   * Call this when system-wide role changes occur.
   * For individual user changes, prefer clearUserCache() instead.
   */
  clearCache(): void {
    this.rolesCache.clear();
    this.permissionCache.clear();
  }

  /**
   * Clear cached data for a specific user.
   *
   * Call this when a user's roles change to ensure fresh permission resolution
   * on their next request. This is more efficient than clearing the entire cache.
   *
   * @param userId - The user ID to clear from cache
   */
  clearUserCache(userId: string): void {
    this.rolesCache.delete(userId);
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
