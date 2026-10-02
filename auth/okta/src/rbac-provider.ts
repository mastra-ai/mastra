/**
 * Okta RBAC provider for Mastra.
 *
 * Maps Okta groups to Mastra permissions using a configurable role mapping.
 * Can be used with any auth provider (Auth0, Clerk, etc.) or with MastraAuthOkta.
 */

import type { IRBACProvider, RoleMapping } from '@internal/auth/ee';
import { resolvePermissionsFromMapping, matchesPermission } from '@internal/auth/ee';
import { LRUCache } from 'lru-cache';

import type { OktaUser, MastraRBACOktaOptions } from './types.js';

/** Default cache TTL in milliseconds (60 seconds) */
const DEFAULT_CACHE_TTL_MS = 60 * 1000;

/** Default max cache size (number of users) */
const DEFAULT_CACHE_MAX_SIZE = 1000;

/** Page size for the Okta list-user-groups call (Okta max is 200) */
const GROUPS_PAGE_LIMIT = 200;

interface OktaGroup {
  profile?: { name?: string };
}

/**
 * Return the rel="next" URL from an Okta Link header, if any.
 * Okta paginates with Link headers: `<https://...>; rel="next"`.
 */
function getNextLink(linkHeader: string | null): string | undefined {
  if (!linkHeader) return undefined;
  for (const part of linkHeader.split(',')) {
    const match = part.match(/<([^>]+)>\s*;\s*rel="?next"?/);
    if (match) return match[1];
  }
  return undefined;
}

/**
 * Okta RBAC provider that maps Okta groups to Mastra permissions.
 *
 * This provider fetches user groups from Okta and translates them into
 * Mastra permissions using a configurable role mapping.
 *
 * @example Basic usage with Okta auth
 * ```typescript
 * import { MastraAuthOkta, MastraRBACOkta } from '@mastra/auth-okta';
 *
 * const mastra = new Mastra({
 *   server: {
 *     auth: new MastraAuthOkta(),
 *     rbac: new MastraRBACOkta({
 *       roleMapping: {
 *         'Engineering': ['agents:*', 'workflows:*'],
 *         'Admin': ['*'],
 *         '_default': [],
 *       },
 *     }),
 *   },
 * });
 * ```
 *
 * @example Cross-provider usage (Auth0 + Okta RBAC)
 * ```typescript
 * import { MastraAuthAuth0 } from '@mastra/auth-auth0';
 * import { MastraRBACOkta } from '@mastra/auth-okta';
 *
 * const mastra = new Mastra({
 *   server: {
 *     auth: new MastraAuthAuth0(),
 *     rbac: new MastraRBACOkta({
 *       getUserId: (user) => user.metadata?.oktaUserId || user.email,
 *       roleMapping: {
 *         'Engineering': ['agents:*', 'workflows:*'],
 *         'Admin': ['*'],
 *         '_default': [],
 *       },
 *     }),
 *   },
 * });
 * ```
 */
export class MastraRBACOkta implements IRBACProvider<OktaUser> {
  private orgUrl: string;
  private apiToken: string;
  private options: MastraRBACOktaOptions;
  /**
   * Single cache for roles (the expensive Okta API call).
   * Permissions are derived from roles on-the-fly (cheap, synchronous).
   * Storing promises handles concurrent request deduplication.
   */
  private rolesCache: LRUCache<string, Promise<string[]>>;

  /**
   * Expose roleMapping for middleware access.
   * This allows the authorization middleware to resolve permissions
   * without needing to call the async methods.
   */
  get roleMapping(): RoleMapping {
    return this.options.roleMapping;
  }

  /**
   * Create a new Okta RBAC provider.
   *
   * @param options - RBAC configuration options
   */
  constructor(options: MastraRBACOktaOptions) {
    const domain = options.domain ?? process.env.OKTA_DOMAIN;
    const apiToken = options.apiToken ?? process.env.OKTA_API_TOKEN;

    if (!domain) {
      throw new Error(
        'Okta domain is required. ' + 'Provide it in the options or set OKTA_DOMAIN environment variable.',
      );
    }

    if (!apiToken) {
      throw new Error(
        'Okta API token is required for RBAC. ' +
          'Provide it in the options or set OKTA_API_TOKEN environment variable.',
      );
    }

    this.orgUrl = `https://${domain}`;
    this.apiToken = apiToken;

    this.options = options;

    // Initialize LRU cache with configurable size and TTL
    this.rolesCache = new LRUCache<string, Promise<string[]>>({
      max: options.cache?.maxSize ?? DEFAULT_CACHE_MAX_SIZE,
      ttl: options.cache?.ttlMs ?? DEFAULT_CACHE_TTL_MS,
    });
  }

  /**
   * Get all roles (groups) for a user from Okta.
   *
   * If the user object already has groups attached, uses those.
   * Otherwise, fetches groups from Okta API and caches the result.
   *
   * @param user - User to get roles for
   * @returns Array of group names
   */
  async getRoles(user: OktaUser): Promise<string[]> {
    // If groups are already present on the user object, use them
    if (user.groups && user.groups.length > 0) {
      return user.groups;
    }

    // Determine the user ID to use for Okta API lookup
    const userId = this.resolveUserId(user);
    if (!userId) {
      return [];
    }

    // Check cache - returns existing promise (resolved or in-flight)
    const cached = this.rolesCache.get(userId);
    if (cached) {
      return cached;
    }

    // Create and cache the group fetch promise.
    // On failure, evict from cache so the next request retries,
    // then fall back to empty groups (which applies _default permissions).
    const groupsPromise = this.fetchGroupsFromOkta(userId).catch(err => {
      console.error(`[MastraRBACOkta] Failed to fetch groups for user ${userId}:`, err);
      this.rolesCache.delete(userId);
      return [];
    });
    this.rolesCache.set(userId, groupsPromise);

    return groupsPromise;
  }

  /**
   * Resolve the Okta user ID from the user object.
   * Uses custom getUserId function if provided, otherwise falls back to oktaId or id.
   */
  private resolveUserId(user: OktaUser): string | undefined {
    if (this.options.getUserId) {
      return this.options.getUserId(user);
    }
    return user.oktaId ?? user.id;
  }

  /**
   * Fetch groups from Okta API.
   * Errors propagate to the caller so the cache eviction in getRoles() works.
   */
  private async fetchGroupsFromOkta(userId: string): Promise<string[]> {
    const groupNames: string[] = [];
    const origin = new URL(this.orgUrl).origin;
    let url: string | undefined =
      `${this.orgUrl}/api/v1/users/${encodeURIComponent(userId)}/groups?limit=${GROUPS_PAGE_LIMIT}`;

    while (url) {
      const response = await fetch(url, {
        headers: {
          Accept: 'application/json',
          Authorization: `SSWS ${this.apiToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Okta list user groups request failed with status ${response.status}`);
      }

      const groups = (await response.json()) as OktaGroup[];
      for (const group of groups) {
        if (group?.profile?.name) {
          groupNames.push(group.profile.name);
        }
      }

      // Only follow pagination links on the same Okta org so the API token never leaves it.
      const next = getNextLink(response.headers.get('link'));
      url = next && new URL(next).origin === origin ? next : undefined;
    }

    return groupNames;
  }

  /**
   * Check if a user has a specific role (group).
   *
   * @param user - User to check
   * @param role - Group name to check for
   * @returns True if user has the group
   */
  async hasRole(user: OktaUser, role: string): Promise<boolean> {
    const roles = await this.getRoles(user);
    return roles.includes(role);
  }

  /**
   * Get all permissions for a user by mapping their Okta groups.
   *
   * @param user - User to get permissions for
   * @returns Array of permission strings
   */
  async getPermissions(user: OktaUser): Promise<string[]> {
    const roles = await this.getRoles(user);
    return resolvePermissionsFromMapping(roles, this.options.roleMapping);
  }

  /**
   * Check if a user has a specific permission.
   *
   * @param user - User to check
   * @param permission - Permission to check for (supports wildcards)
   * @returns True if user has the permission
   */
  async hasPermission(user: OktaUser, permission: string): Promise<boolean> {
    const permissions = await this.getPermissions(user);

    // Check if any granted permission matches the required permission
    return permissions.some(granted => matchesPermission(granted, permission));
  }

  /**
   * Check if a user has ALL of the specified permissions.
   *
   * @param user - User to check
   * @param permissions - Permissions to check for
   * @returns True if user has all permissions
   */
  async hasAllPermissions(user: OktaUser, permissions: string[]): Promise<boolean> {
    const userPermissions = await this.getPermissions(user);

    return permissions.every(required => userPermissions.some(granted => matchesPermission(granted, required)));
  }

  /**
   * Check if a user has ANY of the specified permissions.
   *
   * @param user - User to check
   * @param permissions - Permissions to check for
   * @returns True if user has at least one permission
   */
  async hasAnyPermission(user: OktaUser, permissions: string[]): Promise<boolean> {
    const userPermissions = await this.getPermissions(user);

    return permissions.some(required => userPermissions.some(granted => matchesPermission(granted, required)));
  }
}
