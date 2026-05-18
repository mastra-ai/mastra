/**
 * WorkOS RBAC provider for Mastra.
 *
 * Integrates WorkOS organization memberships and roles with Mastra's
 * permission-based access control system.
 */

import type { IRBACManager, RoleMapping, RBACCapabilities, RoleDefinition } from '@mastra/core/auth/ee';
import { resolvePermissionsFromMapping, matchesPermission, DEFAULT_RBAC_CAPABILITIES } from '@mastra/core/auth/ee';
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

export class MastraRBACWorkos implements IRBACManager<WorkOSUser> {
  private workos: WorkOS;
  private options: MastraRBACWorkosOptions;
  /**
   * Single cache for roles (the expensive WorkOS API call).
   * Permissions are derived from roles on-the-fly (cheap, synchronous).
   * Storing promises handles concurrent request deduplication.
   */
  private rolesCache: LRUCache<string, Promise<string[]>>;

  /**
   * Cache for role definitions with their permissions (from WorkOS API).
   * Used when useProviderPermissions is enabled.
   */
  private roleDefinitionsCache: LRUCache<string, Promise<Map<string, string[]>>>;

  /**
   * Whether to use permissions from WorkOS role definitions instead of roleMapping.
   */
  private useProviderPermissions: boolean;

  /**
   * Expose roleMapping for middleware access.
   * This allows the authorization middleware to resolve permissions
   * without needing to call the async methods.
   */
  get roleMapping(): RoleMapping {
    return this.options.roleMapping ?? {};
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

    // Determine permission source:
    // - useWorkOSRoles explicitly set → use that value
    // - No roleMapping → use provider permissions directly from WorkOS
    // - roleMapping without useWorkOSRoles → use static roleMapping
    this.useProviderPermissions = options.useWorkOSRoles ?? !options.roleMapping;

    // Initialize LRU cache for user roles (the expensive WorkOS API call)
    this.rolesCache = new LRUCache<string, Promise<string[]>>({
      max: options.cache?.maxSize ?? DEFAULT_CACHE_MAX_SIZE,
      ttl: options.cache?.ttlMs ?? DEFAULT_CACHE_TTL_MS,
    });

    // Initialize cache for role definitions with permissions (used when useProviderPermissions is true)
    this.roleDefinitionsCache = new LRUCache<string, Promise<Map<string, string[]>>>({
      max: 1, // Single org's role definitions
      ttl: options.cache?.ttlMs ?? DEFAULT_CACHE_TTL_MS,
    });

    // Validate sync options
    if (options.syncRoles && !options.syncPermissions) {
      throw new Error(
        '[MastraRBACWorkos] syncRoles requires syncPermissions to be enabled. ' +
          'Permissions must exist in WorkOS before roles can reference them.',
      );
    }
    if (options.syncRoles && !options.roleMapping) {
      throw new Error(
        '[MastraRBACWorkos] syncRoles requires roleMapping to be defined. ' +
          'Provide a roleMapping to specify which roles and permissions to sync.',
      );
    }

    // If syncPermissions is enabled, schedule permission sync (and role sync if enabled)
    if (options.syncPermissions) {
      // Sync asynchronously in the background to avoid blocking initialization
      this.syncPermissionsToWorkOS()
        .then(async () => {
          // If syncRoles is enabled, sync roles after permissions
          if (options.syncRoles) {
            await this.syncRolesToWorkOS();
          }
        })
        .catch(error => {
          console.warn('[MastraRBACWorkos] Failed to sync to WorkOS:', error.message);
        });
    }
  }

  /**
   * Sync Mastra's permissions to WorkOS.
   *
   * This method fetches the current permissions from WorkOS and creates
   * any missing permissions from Mastra's roleMapping.
   *
   * @experimental This feature requires WorkOS Permissions API access.
   */
  async syncPermissionsToWorkOS(): Promise<{
    created: string[];
    updated: string[];
    unchanged: string[];
    errors: string[];
  }> {
    const result = {
      created: [] as string[],
      updated: [] as string[],
      unchanged: [] as string[],
      errors: [] as string[],
    };

    try {
      // Import all generated Mastra permissions
      const { PERMISSIONS, ACTIONS, RESOURCES } = await import('@mastra/core/auth/ee');

      // Build full permission set including wildcards
      const mastraPermissions = new Set<string>([
        // Global wildcard
        '*',
        // Action wildcards (*:read, *:write, etc.)
        ...ACTIONS.map((action: string) => `*:${action}`),
        // Resource wildcards (agents:*, workflows:*, etc.)
        ...RESOURCES.map((resource: string) => `${resource}:*`),
        // Specific permissions (agents:read, workflows:write, etc.)
        ...PERMISSIONS,
      ]);

      // Fetch all existing permissions from WorkOS (paginated)
      const existingPermissionsMap = new Map<string, { slug: string; name?: string; description?: string | null }>();
      let after: string | undefined;
      do {
        const response = await this.workos.authorization.listPermissions({ after, limit: 100 });
        for (const p of response.data ?? []) {
          existingPermissionsMap.set(p.slug, p);
        }
        after = response.listMetadata?.after ?? undefined;
      } while (after);

      // Create or update permissions
      for (const permission of mastraPermissions) {
        const { name, description } = this.getPermissionDisplayInfo(permission);
        const existing = existingPermissionsMap.get(permission);

        try {
          if (existing) {
            // Check if update needed
            if (existing.name !== name || existing.description !== description) {
              await this.workos.authorization.updatePermission(permission, { name, description });
              result.updated.push(permission);
              console.info(`[MastraRBACWorkos] Updated permission in WorkOS: ${permission}`);
            } else {
              result.unchanged.push(permission);
            }
          } else {
            // Create new permission
            await this.workos.authorization.createPermission({
              slug: permission,
              name,
              description,
            });
            result.created.push(permission);
            console.info(`[MastraRBACWorkos] Created permission in WorkOS: ${permission}`);
          }
        } catch (error) {
          const errorMsg = `${permission}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          result.errors.push(errorMsg);
          console.warn(`[MastraRBACWorkos] Failed to sync permission: ${errorMsg}`);
        }
      }

      console.info(
        `[MastraRBACWorkos] Permission sync complete: ${result.created.length} created, ${result.updated.length} updated, ${result.unchanged.length} unchanged, ${result.errors.length} errors`,
      );
      if (result.errors.length > 0) {
        console.warn(
          `[MastraRBACWorkos] Errors:\n  ${result.errors.slice(0, 10).join('\n  ')}${result.errors.length > 10 ? `\n  ... and ${result.errors.length - 10} more` : ''}`,
        );
      }
    } catch (error) {
      console.error('[MastraRBACWorkos] Permission sync failed:', error);
      throw error;
    }

    return result;
  }

  /**
   * Sync roles from roleMapping to WorkOS.
   *
   * This method creates or updates roles in WorkOS based on the roleMapping
   * configuration, then assigns the appropriate permissions to each role.
   *
   * @experimental This feature requires WorkOS Roles API access.
   */
  async syncRolesToWorkOS(): Promise<{
    created: string[];
    updated: string[];
    unchanged: string[];
    errors: string[];
  }> {
    const result = {
      created: [] as string[],
      updated: [] as string[],
      unchanged: [] as string[],
      errors: [] as string[],
    };

    const organizationId = this.options.organizationId;
    if (!organizationId) {
      console.warn('[MastraRBACWorkos] Role sync skipped: organizationId not configured');
      return result;
    }

    const roleMapping = this.options.roleMapping;
    if (!roleMapping) {
      console.warn('[MastraRBACWorkos] Role sync skipped: roleMapping not configured');
      return result;
    }

    try {
      // Fetch existing roles from WorkOS
      const existingRolesResponse = await this.workos.authorization.listOrganizationRoles(organizationId);
      const existingRolesMap = new Map(existingRolesResponse.data?.map(r => [r.slug, r]) ?? []);

      // Sync each role from roleMapping
      for (const [roleSlug, permissions] of Object.entries(roleMapping)) {
        // Skip _default as it's not a real role
        if (roleSlug === '_default') continue;

        const { name, description } = this.getRoleDisplayInfo(roleSlug);
        const existing = existingRolesMap.get(roleSlug);

        try {
          if (existing) {
            // Role exists - update permissions
            await this.workos.authorization.setOrganizationRolePermissions(organizationId, roleSlug, {
              permissions: permissions as string[],
            });
            result.updated.push(roleSlug);
            console.info(
              `[MastraRBACWorkos] Updated role in WorkOS: ${roleSlug} with ${permissions.length} permissions`,
            );
          } else {
            // Create new role
            await this.workos.authorization.createOrganizationRole(organizationId, {
              slug: roleSlug,
              name,
              description,
            });
            // Set permissions on the new role
            await this.workos.authorization.setOrganizationRolePermissions(organizationId, roleSlug, {
              permissions: permissions as string[],
            });
            result.created.push(roleSlug);
            console.info(
              `[MastraRBACWorkos] Created role in WorkOS: ${roleSlug} with ${permissions.length} permissions`,
            );
          }
        } catch (error) {
          const errorMsg = `${roleSlug}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          result.errors.push(errorMsg);
          console.warn(`[MastraRBACWorkos] Failed to sync role: ${errorMsg}`);
        }
      }

      console.info(
        `[MastraRBACWorkos] Role sync complete: ${result.created.length} created, ${result.updated.length} updated, ${result.errors.length} errors`,
      );
    } catch (error) {
      console.error('[MastraRBACWorkos] Role sync failed:', error);
      throw error;
    }

    return result;
  }

  /**
   * Generate human-readable name and description for a role slug.
   */
  private getRoleDisplayInfo(roleSlug: string): { name: string; description: string } {
    const name = this.formatLabel(roleSlug);
    const descriptions: Record<string, string> = {
      admin: 'Full administrative access',
      owner: 'Organization owner with full access',
      member: 'Standard team member access',
      viewer: 'Read-only access',
    };
    return {
      name,
      description: descriptions[roleSlug] ?? `Role: ${name}`,
    };
  }

  /**
   * Generate human-readable name and description for a permission slug.
   */
  private getPermissionDisplayInfo(permission: string): { name: string; description: string } {
    if (permission === '*') {
      return { name: 'Full Access', description: 'Full access to all resources and actions' };
    }

    if (permission.startsWith('*:')) {
      const action = permission.slice(2);
      const actionLabel = this.formatLabel(action);
      return {
        name: `All: ${actionLabel}`,
        description: `${actionLabel} access to all resources`,
      };
    }

    if (permission.endsWith(':*')) {
      const resource = permission.slice(0, -2);
      const resourceLabel = this.formatLabel(resource);
      return {
        name: `${resourceLabel}: All`,
        description: `Full access to ${resourceLabel.toLowerCase()}`,
      };
    }

    // Specific permission like "agents:read"
    const [resource = '', action = ''] = permission.split(':');
    const resourceLabel = this.formatLabel(resource);
    const actionLabel = this.formatLabel(action);
    return {
      name: `${resourceLabel}: ${actionLabel}`,
      description: `${actionLabel} access to ${resourceLabel.toLowerCase()}`,
    };
  }

  /**
   * Format a slug segment into a human-readable label.
   * e.g., "agents" -> "Agents", "mcp-servers" -> "MCP Servers"
   */
  private formatLabel(slug: string): string {
    return slug
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Get the capabilities of this RBAC provider.
   *
   * WorkOS supports both single-role and multi-role modes, configured at the
   * environment level in the WorkOS Dashboard.
   */
  getCapabilities(): RBACCapabilities {
    return {
      ...DEFAULT_RBAC_CAPABILITIES,
      // Multi-role support depends on WorkOS environment configuration
      multiRole: this.options.multiRole ?? false,
      // Roles are managed in WorkOS dashboard (or via API)
      providerManagedRoles: true,
      // Roles come from the provider (WorkOS)
      roleSource: 'provider',
      // Permissions come from provider when useProviderPermissions is true
      permissionSource: this.useProviderPermissions ? 'provider' : 'roleMapping',
      // Permissions are derived from static roleMapping config (or from provider if useProviderPermissions)
      permissionEditing: false,
      // Role assignment is supported via WorkOS API
      roleAssignment: true,
    };
  }

  /**
   * List all available role definitions.
   *
   * If an organizationId is configured, fetches roles from WorkOS API and merges
   * with permissions from the roleMapping. Otherwise, returns roles derived from
   * the roleMapping only.
   *
   * This enables displaying provider-managed roles (created in WorkOS dashboard)
   * while still mapping them to Mastra permissions.
   */
  async listRoleDefinitions(): Promise<RoleDefinition[]> {
    // If organization is configured, try to fetch roles from WorkOS
    if (this.options.organizationId) {
      try {
        const workosRoles = await this.workos.organizations.listOrganizationRoles({
          organizationId: this.options.organizationId,
        });

        // Map WorkOS roles to RoleDefinition
        const roleMapping = this.options.roleMapping ?? {};
        return workosRoles.data.map(role => {
          const workosPermissions = role.permissions ?? [];

          // If useProviderPermissions, use WorkOS permissions directly
          // Otherwise, use roleMapping for authorization
          const permissions = this.useProviderPermissions
            ? (workosPermissions as RoleDefinition['permissions'])
            : ((roleMapping[role.slug] ?? roleMapping['_default'] ?? []) as RoleDefinition['permissions']);

          return {
            id: role.slug,
            name: role.name,
            description: role.description ?? this.getRoleDescription(role.slug),
            permissions,
            // Store provider permissions for display when using roleMapping mode
            providerPermissions: this.useProviderPermissions ? undefined : workosPermissions,
            metadata: {
              source: 'provider' as const,
              resourceTypeSlug: role.resourceTypeSlug,
              type: role.type,
            },
          };
        });
      } catch (error) {
        // Fall back to roleMapping-derived roles on error
        console.warn('[MastraRBACWorkos] Failed to fetch roles from WorkOS, falling back to roleMapping', error);
      }
    }

    // Fall back: convert roleMapping to role definitions
    const roleMapping = this.options.roleMapping ?? {};
    return Object.entries(roleMapping)
      .filter(([key]) => key !== '_default')
      .map(([roleName, permissions]) => ({
        id: roleName,
        name: roleName.charAt(0).toUpperCase() + roleName.slice(1), // Capitalize
        description: this.getRoleDescription(roleName),
        permissions: permissions as RoleDefinition['permissions'],
        metadata: {
          source: 'roleMapping' as const,
        },
      }));
  }

  /**
   * Get a description for a role based on its permissions.
   */
  private getRoleDescription(roleName: string): string {
    const roleMapping = this.options.roleMapping ?? {};
    const permissions = roleMapping[roleName] ?? [];
    if (permissions.includes('*')) {
      return 'Full access to all resources';
    }
    if (permissions.every(p => p.endsWith(':read'))) {
      return 'Read-only access';
    }
    if (permissions.some(p => p.endsWith(':execute'))) {
      return 'Read and execute access';
    }
    return `${permissions.length} permission(s)`;
  }

  /**
   * Get all roles for a user from their WorkOS organization memberships.
   *
   * Fetches organization memberships from WorkOS and extracts role slugs.
   * If an organizationId is configured, only returns roles from that organization.
   * Otherwise, returns roles from all organizations the user belongs to.
   *
   * Results are cached and concurrent requests are deduplicated.
   *
   * @param user - WorkOS user to get roles for
   * @returns Array of role slugs
   */
  async getRoles(user: WorkOSUser): Promise<string[]> {
    // If memberships are already present on the user object, use them
    if (user.memberships && user.memberships.length > 0) {
      return this.extractRolesFromMemberships(user);
    }

    const cacheKey = user.workosId ?? user.id;

    // Check cache - returns existing promise (resolved or in-flight)
    const cached = this.rolesCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Create and cache the role fetch promise
    const rolesPromise = this.fetchRolesFromWorkOS(user);
    this.rolesCache.set(cacheKey, rolesPromise);

    return rolesPromise;
  }

  /**
   * Fetch roles from WorkOS API.
   *
   * Handles both single-role and multi-role modes:
   * - Single-role: membership.role.slug
   * - Multi-role: membership.roles[].slug (when enabled in WorkOS)
   */
  private async fetchRolesFromWorkOS(user: WorkOSUser): Promise<string[]> {
    try {
      const memberships = await this.workos.userManagement.listOrganizationMemberships({
        userId: user.workosId,
      });

      // Filter by organization if specified
      const relevantMemberships = this.options.organizationId
        ? memberships.data.filter(m => m.organizationId === this.options.organizationId)
        : memberships.data;

      // Collect all roles from all memberships
      const roles = new Set<string>();
      for (const membership of relevantMemberships) {
        // Multi-role mode: check for roles array first
        const membershipAny = membership as any;
        if (Array.isArray(membershipAny.roles)) {
          for (const role of membershipAny.roles) {
            if (role?.slug) {
              roles.add(role.slug);
            }
          }
        }
        // Single-role mode: use role.slug
        else if (membership.role?.slug) {
          roles.add(membership.role.slug);
        }
      }

      return Array.from(roles);
    } catch {
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
   * Get all permissions for a user.
   *
   * Two modes of operation:
   * 1. useProviderPermissions=false (default when roleMapping provided):
   *    Uses the configured roleMapping to translate WorkOS role slugs
   *    into Mastra permission strings.
   *
   * 2. useProviderPermissions=true (default when no roleMapping):
   *    Fetches permissions directly from WorkOS role definitions.
   *    Permissions in WorkOS must match Mastra's resource:action pattern.
   *
   * Roles are cached; permissions are derived on-the-fly.
   *
   * @param user - WorkOS user to get permissions for
   * @returns Array of permission strings
   */
  async getPermissions(user: WorkOSUser): Promise<string[]> {
    const roles = await this.getRoles(user);

    if (roles.length === 0) {
      return this.options.roleMapping?.['_default'] ?? [];
    }

    // Use provider permissions if enabled
    if (this.useProviderPermissions) {
      return this.getPermissionsFromProvider(roles);
    }

    // Use static roleMapping
    return resolvePermissionsFromMapping(roles, this.options.roleMapping ?? {});
  }

  /**
   * Fetch permissions from WorkOS role definitions.
   *
   * Fetches role definitions from WorkOS API and extracts permissions
   * for the user's roles. Results are cached.
   *
   * @param userRoles - User's role slugs
   * @returns Array of permission strings from WorkOS
   */
  private async getPermissionsFromProvider(userRoles: string[]): Promise<string[]> {
    const rolePermissionsMap = await this.getRoleDefinitionsMap();

    const permissions = new Set<string>();
    for (const roleSlug of userRoles) {
      const rolePerms = rolePermissionsMap.get(roleSlug);
      if (rolePerms) {
        for (const perm of rolePerms) {
          permissions.add(perm);
        }
      }
    }

    return Array.from(permissions);
  }

  /**
   * Get a map of role slugs to their permissions from WorkOS.
   *
   * Fetches role definitions from WorkOS API and caches the result.
   * This is used when useProviderPermissions is enabled.
   */
  private async getRoleDefinitionsMap(): Promise<Map<string, string[]>> {
    const cacheKey = this.options.organizationId ?? 'default';

    const cached = this.roleDefinitionsCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const fetchPromise = this.fetchRoleDefinitionsFromWorkOS();
    this.roleDefinitionsCache.set(cacheKey, fetchPromise);

    return fetchPromise;
  }

  /**
   * Fetch role definitions with permissions from WorkOS API.
   */
  private async fetchRoleDefinitionsFromWorkOS(): Promise<Map<string, string[]>> {
    const roleMap = new Map<string, string[]>();

    if (!this.options.organizationId) {
      // Without organization, fall back to roleMapping if available
      if (this.options.roleMapping) {
        for (const [roleSlug, perms] of Object.entries(this.options.roleMapping)) {
          if (roleSlug !== '_default') {
            roleMap.set(roleSlug, perms);
          }
        }
      }
      return roleMap;
    }

    try {
      const rolesResponse = await this.workos.organizations.listOrganizationRoles({
        organizationId: this.options.organizationId,
      });

      for (const role of rolesResponse.data) {
        // WorkOS role.permissions is an array of permission strings
        roleMap.set(role.slug, role.permissions ?? []);
      }
    } catch (error) {
      console.warn('[MastraRBACWorkos] Failed to fetch role definitions from WorkOS:', error);
      // Fall back to roleMapping if available
      if (this.options.roleMapping) {
        for (const [roleSlug, perms] of Object.entries(this.options.roleMapping)) {
          if (roleSlug !== '_default') {
            roleMap.set(roleSlug, perms);
          }
        }
      }
    }

    return roleMap;
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
   * Clear the roles cache.
   *
   * Call this when system-wide role changes occur.
   * For individual user changes, prefer clearUserCache() instead.
   */
  clearCache(): void {
    this.rolesCache.clear();
  }

  /**
   * Clear cached roles for a specific user.
   *
   * Call this when a user's roles change to ensure fresh permission resolution
   * on their next request. This is more efficient than clearing the entire cache.
   *
   * @param userId - The user ID to clear from cache
   */
  clearUserCache(userId: string): void {
    this.rolesCache.delete(userId);
  }

  /**
   * Get cache statistics for monitoring.
   *
   * @returns Object with cache size and max size
   */
  getCacheStats(): { size: number; maxSize: number } {
    return {
      size: this.rolesCache.size,
      maxSize: this.rolesCache.max,
    };
  }

  /**
   * Extract role slugs from memberships attached to the user object.
   *
   * Handles both single-role and multi-role modes:
   * - Single-role: membership.role.slug
   * - Multi-role: membership.roles[].slug (when enabled in WorkOS)
   *
   * @param user - WorkOS user with memberships
   * @returns Array of role slugs (deduplicated)
   */
  private extractRolesFromMemberships(user: WorkOSUser): string[] {
    if (!user.memberships) {
      return [];
    }

    // Filter by organization if specified
    const relevantMemberships = this.options.organizationId
      ? user.memberships.filter(m => m.organizationId === this.options.organizationId)
      : user.memberships;

    // Collect all roles from all memberships
    const roles = new Set<string>();
    for (const membership of relevantMemberships) {
      // Multi-role mode: check for roles array first
      const membershipAny = membership as any;
      if (Array.isArray(membershipAny.roles)) {
        for (const role of membershipAny.roles) {
          if (role?.slug) {
            roles.add(role.slug);
          }
        }
      }
      // Single-role mode: use role.slug
      else if (membership.role?.slug) {
        roles.add(membership.role.slug);
      }
    }

    return Array.from(roles);
  }

  /**
   * Assign a role to a user in the configured organization.
   *
   * Behavior depends on multi-role mode:
   * - Single-role (default): Replaces the user's current role
   * - Multi-role: Adds the role to the user's existing roles
   *
   * @param userId - The WorkOS user ID
   * @param roleId - The role slug to assign
   */
  async assignRole(userId: string, roleId: string): Promise<void> {
    if (!this.options.organizationId) {
      throw new Error('organizationId is required for role assignment');
    }

    // Find the user's membership in this organization
    const memberships = await this.workos.userManagement.listOrganizationMemberships({
      organizationId: this.options.organizationId,
      userId,
    });

    if (memberships.data.length === 0) {
      throw new Error(`User ${userId} is not a member of organization ${this.options.organizationId}`);
    }

    const membership = memberships.data[0]!;

    if (this.options.multiRole) {
      // Multi-role mode: add role to existing roles
      const membershipAny = membership as any;
      const currentRoles: string[] = Array.isArray(membershipAny.roles)
        ? membershipAny.roles.map((r: any) => r.slug)
        : [membership.role?.slug].filter(Boolean);

      // Add new role if not already present
      if (!currentRoles.includes(roleId)) {
        const newRoles = [...currentRoles, roleId];
        await this.workos.userManagement.updateOrganizationMembership(membership.id, {
          roleSlugs: newRoles,
        } as any);
      }
    } else {
      // Single-role mode: replace current role
      await this.workos.userManagement.updateOrganizationMembership(membership.id, {
        roleSlug: roleId,
      });
    }

    // Invalidate cache for this user
    this.rolesCache.delete(userId);
  }

  /**
   * Remove a role from a user.
   *
   * Behavior depends on multi-role mode:
   * - Single-role (default): Not supported - throws error
   * - Multi-role: Removes the specified role from the user's roles
   *
   * @param userId - The WorkOS user ID
   * @param roleId - The role slug to remove
   */
  async removeRole(userId: string, roleId: string): Promise<void> {
    if (!this.options.multiRole) {
      throw new Error(
        'WorkOS single-role mode does not support removing roles. Use assignRole to change roles, ' +
          'or remove the membership entirely via the WorkOS dashboard.',
      );
    }

    if (!this.options.organizationId) {
      throw new Error('organizationId is required for role removal');
    }

    // Find the user's membership in this organization
    const memberships = await this.workos.userManagement.listOrganizationMemberships({
      organizationId: this.options.organizationId,
      userId,
    });

    if (memberships.data.length === 0) {
      throw new Error(`User ${userId} is not a member of organization ${this.options.organizationId}`);
    }

    const membership = memberships.data[0]!;
    const membershipAny = membership as any;

    // Get current roles
    const currentRoles: string[] = Array.isArray(membershipAny.roles)
      ? membershipAny.roles.map((r: any) => r.slug)
      : [membership.role?.slug].filter(Boolean);

    // Remove the specified role
    const newRoles = currentRoles.filter(r => r !== roleId);

    if (newRoles.length === 0) {
      throw new Error('Cannot remove the last role. Users must have at least one role.');
    }

    await this.workos.userManagement.updateOrganizationMembership(membership.id, {
      roleSlugs: newRoles,
    } as any);

    // Invalidate cache for this user
    this.rolesCache.delete(userId);
  }
}
