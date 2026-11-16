/**
 * Neon Auth RBAC provider for Mastra.
 *
 * Maps Neon Auth organization roles (from the Organization plugin)
 * to Mastra permissions using a configurable role mapping.
 */

import type { IRBACProvider, RoleMapping } from '@mastra/core/auth/ee';
import { resolvePermissionsFromMapping, matchesPermission } from '@mastra/core/auth/ee';

import { getLinkedNeonUser, getRememberedSessionCookie, stripTrailingSlashes } from './session-cookie';
import type { NeonAuthUser } from './index';

export interface NeonRoleMappingOptions {
  /** Cache TTL in milliseconds (default: 60_000) */
  ttlMs?: number;
  /** Max cache entries (default: 1000) */
  maxSize?: number;
}

export interface MastraRBACNeonOptions {
  /**
   * The Neon Auth URL.
   * Falls back to the `NEON_AUTH_BASE_URL` environment variable.
   */
  baseUrl?: string;
  /**
   * Map Neon Auth role names to arrays of Mastra permission patterns.
   * Use `_default` for roles not explicitly listed.
   *
   * @example
   * ```typescript
   * {
   *   owner: ['*'],
   *   admin: ['*'],
   *   member: ['agents:read', 'workflows:*'],
   *   _default: [],
   * }
   * ```
   */
  roleMapping: RoleMapping;
  /**
   * Organization whose membership role is used.
   * When omitted, the session's active organization is used.
   */
  organizationId?: string;
  /** Caching options for role lookups. */
  cache?: NeonRoleMappingOptions;
  /**
   * Custom function to resolve roles for a user.
   * Use this for bearer JWT requests when roles live outside Neon Auth organizations,
   * since Neon Auth JWTs don't carry organization roles.
   */
  getUserRoles?: (user: NeonAuthUser) => string[] | Promise<string[]>;
}

const DEFAULT_CACHE_TTL_MS = 60_000;
const DEFAULT_CACHE_MAX_SIZE = 1000;

interface CacheEntry {
  roles: string[];
  expiresAt: number;
}

function splitRoles(role: string | null | undefined): string[] {
  if (!role) return [];
  return role
    .split(',')
    .map(r => r.trim())
    .filter(Boolean);
}

/**
 * RBAC provider for Neon Auth that maps organization roles to Mastra permissions.
 *
 * Roles are resolved in this order:
 * 1. `getUserRoles`, when provided.
 * 2. When `organizationId` is set or the session has an active organization:
 *    the user's role in that organization, read from Neon Auth with the
 *    user's session cookie. Non-members get no roles.
 * 3. Otherwise: the user's Neon Auth role (for example `user` or `admin`).
 *
 * Bearer JWT requests carry no session, so no roles resolve (and no
 * permissions are granted) unless `getUserRoles` is provided.
 *
 * @example
 * ```typescript
 * import { MastraRBACNeon } from '@mastra/auth-neon';
 *
 * const rbac = new MastraRBACNeon({
 *   roleMapping: {
 *     owner: ['*'],
 *     admin: ['*'],
 *     member: ['agents:read', 'workflows:*'],
 *     _default: [],
 *   },
 * });
 * ```
 */
export class MastraRBACNeon implements IRBACProvider<NeonAuthUser> {
  private options: MastraRBACNeonOptions;
  private baseUrl: string;
  private rolesCache: Map<string, CacheEntry> = new Map();
  private cacheTtlMs: number;
  private cacheMaxSize: number;

  get roleMapping(): RoleMapping {
    return this.options.roleMapping;
  }

  constructor(options: MastraRBACNeonOptions) {
    this.options = options;
    this.baseUrl = stripTrailingSlashes(options.baseUrl ?? process.env.NEON_AUTH_BASE_URL ?? '');
    this.cacheTtlMs = options.cache?.ttlMs ?? DEFAULT_CACHE_TTL_MS;
    this.cacheMaxSize = options.cache?.maxSize ?? DEFAULT_CACHE_MAX_SIZE;
  }

  async getRoles(input: NeonAuthUser): Promise<string[]> {
    // `GET /auth/me` passes the EEUser returned by getCurrentUser().
    const user = (input && 'user' in input ? input : getLinkedNeonUser(input)) as NeonAuthUser | undefined;
    if (!user) return [];

    if (this.options.getUserRoles) {
      return this.options.getUserRoles(user);
    }

    const userId = user.user?.id;
    if (!userId) return [];

    const organizationId = this.options.organizationId ?? user.session?.activeOrganizationId ?? undefined;
    const sessionCookie = getRememberedSessionCookie(user);

    if (organizationId) {
      // Organization-scoped: only the membership role counts, so a non-member
      // never inherits permissions from their app-wide Neon Auth role.
      return sessionCookie ? this.getOrganizationRoles(userId, organizationId, sessionCookie) : [];
    }

    return splitRoles(user.user.role);
  }

  async hasRole(user: NeonAuthUser, role: string): Promise<boolean> {
    const roles = await this.getRoles(user);
    return roles.includes(role);
  }

  async getPermissions(user: NeonAuthUser): Promise<string[]> {
    const roles = await this.getRoles(user);
    return resolvePermissionsFromMapping(roles, this.options.roleMapping);
  }

  async hasPermission(user: NeonAuthUser, permission: string): Promise<boolean> {
    const permissions = await this.getPermissions(user);
    return permissions.some(p => matchesPermission(p, permission));
  }

  async hasAllPermissions(user: NeonAuthUser, permissions: string[]): Promise<boolean> {
    const userPermissions = await this.getPermissions(user);
    return permissions.every(required => userPermissions.some(p => matchesPermission(p, required)));
  }

  async hasAnyPermission(user: NeonAuthUser, permissions: string[]): Promise<boolean> {
    const userPermissions = await this.getPermissions(user);
    return permissions.some(required => userPermissions.some(p => matchesPermission(p, required)));
  }

  async getAvailableRoles(): Promise<{ id: string; name: string }[]> {
    return Object.keys(this.options.roleMapping)
      .filter(k => k !== '_default')
      .map(k => ({ id: k, name: k.charAt(0).toUpperCase() + k.slice(1) }));
  }

  async getRolePermissions(roleId: string): Promise<string[]> {
    return resolvePermissionsFromMapping([roleId], this.options.roleMapping);
  }

  private async getOrganizationRoles(userId: string, organizationId: string, sessionCookie: string): Promise<string[]> {
    const cacheKey = `${userId}:${organizationId}`;
    const cached = this.rolesCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      // Promote on hit for LRU eviction.
      this.rolesCache.delete(cacheKey);
      this.rolesCache.set(cacheKey, cached);
      return cached.roles;
    }

    const roles = await this.fetchOrganizationRoles(organizationId, sessionCookie);
    if (roles === null) return [];

    if (this.rolesCache.size >= this.cacheMaxSize) {
      const firstKey = this.rolesCache.keys().next().value;
      if (firstKey) this.rolesCache.delete(firstKey);
    }
    this.rolesCache.set(cacheKey, { roles, expiresAt: Date.now() + this.cacheTtlMs });
    return roles;
  }

  /**
   * Reads the signed-in user's role in an organization from Neon Auth.
   * Returns `[]` when the user is not a member, or `null` when the lookup
   * failed and the result should not be cached.
   */
  private async fetchOrganizationRoles(organizationId: string, sessionCookie: string): Promise<string[] | null> {
    if (!this.baseUrl) return null;

    try {
      const url = new URL(`${this.baseUrl}/organization/get-active-member-role`);
      url.searchParams.set('organizationId', organizationId);
      const response = await fetch(url, { headers: { Cookie: sessionCookie } });

      // 403 means "not a member" and is safe to cache. Anything else (expired
      // session, rate limit, outage) is transient and must not be cached.
      if (response.status === 403) return [];
      if (!response.ok) return null;

      const data = (await response.json()) as { role?: string | null } | null;
      return splitRoles(data?.role);
    } catch {
      return null;
    }
  }
}
