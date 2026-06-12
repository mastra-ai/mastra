/**
 * Neon Auth RBAC provider for Mastra.
 *
 * Maps Neon Auth organization roles (via Better Auth's Organization plugin)
 * to Mastra permissions using a configurable role mapping.
 */

import type { IRBACProvider, RoleMapping } from '@mastra/core/auth/ee';
import { resolvePermissionsFromMapping, matchesPermission } from '@mastra/core/auth/ee';

import type { NeonAuthUser } from './index';

/**
 * Response shape from the Neon Auth organization member endpoint.
 */
interface NeonOrgMember {
  id: string;
  organizationId: string;
  userId: string;
  role: string;
  createdAt: string;
}

export interface NeonRoleMappingOptions {
  /** Cache TTL in milliseconds (default: 60_000) */
  ttlMs?: number;
  /** Max cache entries (default: 1000) */
  maxSize?: number;
}

export interface MastraRBACNeonOptions {
  /**
   * Base URL for the Neon Auth service.
   * Falls back to `NEON_AUTH_BASE_URL` env var.
   */
  baseUrl?: string;
  /**
   * Map provider role slugs to arrays of Mastra permission patterns.
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
   * Specific organization ID to scope role lookups to.
   * If omitted, roles from all organizations are merged.
   */
  organizationId?: string;
  /** Caching options for role lookups. */
  cache?: NeonRoleMappingOptions;
  /**
   * Custom function to extract roles from the NeonAuthUser object.
   * Useful when JWT claims already contain role info.
   */
  getUserRoles?: (user: NeonAuthUser) => string[] | Promise<string[]>;
}

const DEFAULT_CACHE_TTL_MS = 60_000;
const DEFAULT_CACHE_MAX_SIZE = 1000;

interface CacheEntry {
  roles: string[];
  expiresAt: number;
}

/**
 * RBAC provider for Neon Auth that maps organization roles to Mastra permissions.
 *
 * Neon Auth uses Better Auth's Organization plugin which provides `owner`,
 * `admin`, and `member` roles. This provider maps those roles to Mastra
 * permission patterns via a configurable `roleMapping`.
 *
 * @example Static mapping
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
 *
 * @example With custom role extraction from JWT claims
 * ```typescript
 * const rbac = new MastraRBACNeon({
 *   roleMapping: {
 *     admin: ['*'],
 *     member: ['agents:read'],
 *   },
 *   getUserRoles: (user) => {
 *     const role = user.jwt?.role as string;
 *     return role ? [role] : [];
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
    const rawUrl = options.baseUrl ?? process.env.NEON_AUTH_BASE_URL ?? '';
    this.baseUrl = rawUrl.endsWith('/') ? rawUrl.replace(/\/+$/, '') : rawUrl;
    this.cacheTtlMs = options.cache?.ttlMs ?? DEFAULT_CACHE_TTL_MS;
    this.cacheMaxSize = options.cache?.maxSize ?? DEFAULT_CACHE_MAX_SIZE;
  }

  async getRoles(user: NeonAuthUser): Promise<string[]> {
    if (this.options.getUserRoles) {
      return this.options.getUserRoles(user);
    }

    // Try extracting role from JWT claims first (fast path).
    if (user.jwt) {
      const role = user.jwt.role as string | undefined;
      if (role) return [role];
    }

    const userId = user.user?.id;
    if (!userId) return [];

    // Check cache (promote on hit for LRU eviction).
    const cached = this.rolesCache.get(userId);
    if (cached && cached.expiresAt > Date.now()) {
      this.rolesCache.delete(userId);
      this.rolesCache.set(userId, cached);
      return cached.roles;
    }

    // Fetch organization memberships from Neon Auth.
    const roles = await this.fetchRolesFromNeonAuth(userId);

    // Cache the result.
    if (this.rolesCache.size >= this.cacheMaxSize) {
      const firstKey = this.rolesCache.keys().next().value;
      if (firstKey) this.rolesCache.delete(firstKey);
    }
    this.rolesCache.set(userId, { roles, expiresAt: Date.now() + this.cacheTtlMs });

    return roles;
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

  /**
   * Fetch organization membership roles from Neon Auth.
   *
   * Uses Better Auth's `organization/list-memberships` admin API.
   * Falls back to empty roles on error (default permissions will apply).
   */
  private async fetchRolesFromNeonAuth(userId: string): Promise<string[]> {
    if (!this.baseUrl) return [];

    try {
      const response = await fetch(`${this.baseUrl}/auth/api/organization/list-memberships`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) return [];

      const data = (await response.json()) as NeonOrgMember[] | { data?: NeonOrgMember[] };
      const memberships = Array.isArray(data) ? data : (data.data ?? []);

      const relevant = this.options.organizationId
        ? memberships.filter(m => m.organizationId === this.options.organizationId)
        : memberships;

      return relevant.map(m => m.role);
    } catch {
      return [];
    }
  }
}
