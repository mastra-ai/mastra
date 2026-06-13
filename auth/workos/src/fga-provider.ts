/**
 * WorkOS FGA provider for Mastra.
 *
 * Integrates WorkOS Authorization API with Mastra's FGA interface
 * for permission-based, resource-level authorization.
 *
 * @license Mastra Enterprise License - see ee/LICENSE
 */

import type {
  IFGAManager,
  FGACheckParams,
  FGAResource,
  FGAResourceTypeInfo,
  FGARegisterResourceParams,
  FGARegistrationResult,
  FGACreateResourceParams,
  FGAUpdateResourceParams,
  FGADeleteResourceParams,
  FGAListResourcesOptions,
  FGARoleAssignment,
  FGARoleParams,
  FGAListRoleAssignmentsOptions,
  MastraFGAPermissionInput,
} from '@mastra/core/auth/ee';
import { FGADeniedError } from '@mastra/core/auth/ee';
import type { IMastraLogger } from '@mastra/core/logger';
import { WorkOS } from '@workos-inc/node';

import type { MastraFGAWorkosOptions, FGAResourceMappingEntry, WorkOSUser } from './types';

const FILTER_ACCESSIBLE_CHECK_CONCURRENCY = 5;

function isWorkOSResourceNotFoundError(error: any): boolean {
  return error?.status === 404 || error?.code === 'entity_not_found';
}

export class WorkOSFGAResourceNotFoundError extends Error {
  readonly status = 404;
  readonly resourceType: string;
  readonly resourceId: string;

  constructor(resourceType: string, resourceId: string) {
    super(
      `[MastraFGAWorkos] Resource '${resourceType}/${resourceId}' is not registered in WorkOS. ` +
        `Create the '${resourceType}' resource type in your WorkOS dashboard, ` +
        `then register '${resourceId}' using MastraFGAWorkos.createResource() or your seed script. ` +
        `See https://workos.com/docs/fga for setup instructions.`,
    );
    this.name = 'WorkOSFGAResourceNotFoundError';
    this.resourceType = resourceType;
    this.resourceId = resourceId;
  }
}

export class WorkOSFGAMembershipResolutionError extends Error {
  readonly status = 500;
  readonly userId?: string;

  constructor(user: WorkOSUser) {
    super(
      '[MastraFGAWorkos] Cannot resolve organization membership for user <redacted>. ' +
        'Ensure fetchMemberships is enabled on MastraAuthWorkos or provide organizationMembershipId on the user.',
    );
    this.name = 'WorkOSFGAMembershipResolutionError';
    this.userId = user?.id ? '<redacted>' : undefined;
  }
}

/**
 * WorkOS FGA provider using the new Authorization API.
 *
 * Uses `resourceMapping` to translate Mastra resource types to WorkOS FGA resource types
 * and `permissionMapping` to translate Mastra permissions to WorkOS permission slugs.
 *
 * @example Basic usage
 * ```typescript
 * import { MastraFGAWorkos } from '@mastra/auth-workos';
 * import { MastraFGAPermissions } from '@mastra/core/auth/ee';
 *
 * const fga = new MastraFGAWorkos({
 *   resourceMapping: {
 *     agent: { fgaResourceType: 'team', deriveId: (ctx) => ctx.user.teamId },
 *     workflow: { fgaResourceType: 'team', deriveId: (ctx) => ctx.user.teamId },
 *     thread: { fgaResourceType: 'workspace-thread', deriveId: ({ resourceId }) => resourceId },
 *   },
 *   permissionMapping: {
 *     [MastraFGAPermissions.AGENTS_EXECUTE]: 'manage-workflows',
 *     [MastraFGAPermissions.WORKFLOWS_EXECUTE]: 'manage-workflows',
 *     [MastraFGAPermissions.MEMORY_READ]: 'read',
 *     [MastraFGAPermissions.MEMORY_WRITE]: 'update',
 *   },
 * });
 * ```
 *
 * @example With Mastra server config
 * ```typescript
 * const mastra = new Mastra({
 *   server: {
 *     auth: new MastraAuthWorkos({ ... }),
 *     fga: new MastraFGAWorkos({
 *       resourceMapping: { ... },
 *       permissionMapping: { ... },
 *     }),
 *   },
 * });
 * ```
 */
export class MastraFGAWorkos implements IFGAManager<WorkOSUser> {
  private workos: WorkOS;
  private organizationId?: string;
  private resourceMapping: Record<string, FGAResourceMappingEntry>;
  private permissionMapping: Record<string, string>;
  private logger?: IMastraLogger;
  private warnedResources = new Set<string>(); // Track warnings to avoid spam
  // Cache keyed by organizationId to avoid cross-org data leakage
  private resourceTypesCache = new Map<string, { types: FGAResourceTypeInfo[]; timestamp: number }>();
  private readonly RESOURCE_TYPES_CACHE_TTL = 60_000; // 1 minute cache
  readonly requireForProtectedRoutes?: boolean;
  readonly auditProtectedRoutes?: boolean | 'warn' | 'error';
  readonly resolveRouteFGA?: MastraFGAWorkosOptions['resolveRouteFGA'];
  readonly validatePermissions?: MastraFGAWorkosOptions['validatePermissions'];
  readonly publicByDefault: boolean;
  readonly ownership?: {
    enabled: boolean;
    ownerRole: string;
    fallbackRoles: string[];
  };

  constructor(options: MastraFGAWorkosOptions) {
    const apiKey = options.apiKey ?? process.env.WORKOS_API_KEY;
    const clientId = options.clientId ?? process.env.WORKOS_CLIENT_ID;

    if (!apiKey || !clientId) {
      throw new Error(
        'WorkOS API key and client ID are required. ' +
          'Provide them in the options or set WORKOS_API_KEY and WORKOS_CLIENT_ID environment variables.',
      );
    }

    this.workos = new WorkOS(apiKey, { clientId });
    this.organizationId = options.organizationId;
    this.resourceMapping = options.resourceMapping ?? {};
    this.permissionMapping = options.permissionMapping ?? {};
    this.logger = options.logger;
    this.requireForProtectedRoutes = options.requireForProtectedRoutes;
    this.auditProtectedRoutes = options.auditProtectedRoutes;
    this.resolveRouteFGA = options.resolveRouteFGA;
    this.validatePermissions = options.validatePermissions;
    this.publicByDefault = options.publicByDefault ?? false;

    // Ownership configuration
    if (options.ownership?.enabled) {
      this.ownership = {
        enabled: true,
        ownerRole: options.ownership.ownerRole || 'owner',
        fallbackRoles: options.ownership.fallbackRoles || ['admin', 'editor'],
      };
    }
  }

  // ──────────────────────────────────────────────────────────────
  // IFGAProvider — Read-only checks
  // ──────────────────────────────────────────────────────────────

  /**
   * Check if a user has permission on a resource.
   *
   * Resolves the user's organization membership ID, maps the permission
   * via `permissionMapping`, and delegates to `workos.authorization.check()`.
   *
   * When `params.permission` is an array, ANY-of semantics apply: returns true
   * if any single permission in the array authorizes the user.
   */
  async check(user: WorkOSUser, params: FGACheckParams): Promise<boolean> {
    const permissions = Array.isArray(params.permission) ? params.permission : [params.permission];
    if (permissions.length === 0) return false;

    const { type: resourceType, id: resourceId } = params.resource;
    let allResourceNotFound = true;
    let hasUnresolvedMembership = false;
    let attemptedCheck = false;
    let deniedPermission: string | undefined;

    for (const permission of permissions) {
      const checkOptions = this.buildCheckOptions(user, { ...params, permission });
      if (!checkOptions) {
        // buildCheckOptions returned null (e.g., membership resolution failed)
        // This is NOT a "resource not found" case - it's a membership issue
        hasUnresolvedMembership = true;
        continue;
      }
      attemptedCheck = true;
      try {
        const result = await this.workos.authorization.check(checkOptions);
        allResourceNotFound = false; // Resource exists, we got a real response
        if (result.authorized) return true;
        // Track which permission was denied for logging
        deniedPermission = String(permission);
      } catch (error: any) {
        if (isWorkOSResourceNotFoundError(error)) continue;
        throw error;
      }
    }

    // If we couldn't resolve membership for any check, deny access
    // (don't let publicByDefault grant access when membership is the issue)
    if (hasUnresolvedMembership && !attemptedCheck) {
      const resourceKey = `${resourceType}:${resourceId}`;
      if (!this.warnedResources.has(`membership:${resourceKey}`)) {
        this.warnedResources.add(`membership:${resourceKey}`);
        this.logger?.warn(
          `[FGA] Access denied: cannot resolve organization membership for user. ` +
            `Ensure fetchMemberships is enabled on MastraAuthWorkos when using FGA.`,
        );
      }
      return false;
    }

    // If all permissions resulted in "resource not found", apply publicByDefault behavior
    if (attemptedCheck && allResourceNotFound) {
      const resourceKey = `${resourceType}:${resourceId}`;
      if (this.publicByDefault) {
        // Only warn once per resource to avoid log spam
        if (!this.warnedResources.has(resourceKey)) {
          this.warnedResources.add(resourceKey);
          this.logger?.debug(
            `[FGA] Resource '${resourceKey}' is not registered in WorkOS. ` +
              `Access allowed because publicByDefault is enabled.`,
          );
        }
        return true;
      } else {
        if (!this.warnedResources.has(resourceKey)) {
          this.warnedResources.add(resourceKey);
          this.logger?.warn(
            `[FGA] Access denied: resource '${resourceKey}' is not registered in WorkOS. ` +
              `Register it using createResource() or enable publicByDefault to allow unregistered resources.`,
          );
        }
        return false;
      }
    }

    // Resource exists but user doesn't have permission - always warn (this is a real access issue)
    this.logger?.warn(
      `[FGA] Access denied: user does not have '${deniedPermission}' permission on '${resourceType}:${resourceId}'. ` +
        `Assign the appropriate role to the user in WorkOS dashboard or via assignRole().`,
    );

    return false;
  }

  /**
   * Require that a user has permission, throwing FGADeniedError if not.
   *
   * When `params.permission` is an array, ANY-of semantics apply: passes if any
   * single permission authorizes the user; throws if none do.
   *
   * Respects `publicByDefault` configuration - if enabled and the resource is
   * not registered in WorkOS, the check passes (resource is considered public).
   */
  async require(user: WorkOSUser, params: FGACheckParams): Promise<void> {
    const permissions = Array.isArray(params.permission) ? params.permission : [params.permission];
    if (permissions.length === 0) {
      throw new FGADeniedError(user, params.resource, params.permission);
    }

    const { type: resourceType, id: resourceId } = params.resource;
    let allResourceNotFound = true;
    let hasUnresolvedMembership = false;
    let attemptedCheck = false;
    let lastError: unknown;

    for (const permission of permissions) {
      const checkOptions = this.buildCheckOptions(
        user,
        { ...params, permission },
        { strictMembershipResolution: true },
      );
      if (!checkOptions) {
        hasUnresolvedMembership = true;
        continue;
      }
      attemptedCheck = true;

      try {
        const result = await this.workos.authorization.check(checkOptions);
        allResourceNotFound = false;
        if (result.authorized) return;
      } catch (error: any) {
        if (error instanceof FGADeniedError) throw error;
        if (isWorkOSResourceNotFoundError(error)) continue;
        lastError = error;
      }
    }

    // If we couldn't resolve membership for any check, throw membership error
    if (hasUnresolvedMembership && !attemptedCheck) {
      throw new WorkOSFGAMembershipResolutionError(user);
    }

    // If all permissions resulted in "resource not found", apply publicByDefault behavior
    if (attemptedCheck && allResourceNotFound) {
      if (this.publicByDefault) {
        // Resource not registered but publicByDefault is enabled - allow access
        const resourceKey = `${resourceType}:${resourceId}`;
        if (!this.warnedResources.has(resourceKey)) {
          this.warnedResources.add(resourceKey);
          this.logger?.debug(
            `[FGA] Resource '${resourceKey}' is not registered in WorkOS. ` +
              `Access allowed because publicByDefault is enabled.`,
          );
        }
        return;
      }
      // Resource not registered and publicByDefault is disabled - throw specific error
      throw new WorkOSFGAResourceNotFoundError(resourceType, resourceId);
    }

    if (lastError) throw lastError;
    throw new FGADeniedError(user, params.resource, params.permission);
  }

  /**
   * Filter resources to only those the user has permission to access.
   *
   * Uses WorkOS `listResourcesForMembership()` when the resource mapping can
   * resolve a parent resource from user context. This avoids one check per
   * resource for list endpoints like agents/workflows/tools.
   *
   * Falls back to per-resource `check()` calls when no parent resource can be
   * resolved from the configured mapping.
   */
  async filterAccessible<T extends { id: string }>(
    user: WorkOSUser,
    resources: T[],
    resourceType: string,
    permission: MastraFGAPermissionInput,
  ): Promise<T[]> {
    if (resources.length === 0) return [];

    const membershipId = this.resolveOrganizationMembershipId(user);
    if (!membershipId) return [];

    const permissionSlug = this.resolvePermission(permission);
    const parentResource = resourceType === 'thread' ? undefined : this.resolveParentResource(user, resourceType);
    if (parentResource) {
      const accessibleIds = await this.listAccessibleResourceExternalIds({
        organizationMembershipId: membershipId,
        permissionSlug,
        parentResourceExternalId: parentResource.externalId,
        parentResourceTypeSlug: parentResource.typeSlug,
      });

      return resources.filter(resource => {
        const mappedId = this.resolveResourceId(
          user,
          resourceType,
          resource.id,
          'resourceId' in resource && typeof resource.resourceId === 'string'
            ? { resourceId: resource.resourceId }
            : undefined,
        );
        return !!mappedId && accessibleIds.has(mappedId);
      });
    }

    const checks: Array<{ resource: T; authorized: boolean }> = [];
    for (let start = 0; start < resources.length; start += FILTER_ACCESSIBLE_CHECK_CONCURRENCY) {
      const batch = resources.slice(start, start + FILTER_ACCESSIBLE_CHECK_CONCURRENCY);
      const batchChecks = await Promise.all(
        batch.map(async resource => {
          const authorized = await this.check(user, {
            resource: { type: resourceType, id: resource.id },
            permission,
            context:
              'resourceId' in resource && typeof resource.resourceId === 'string'
                ? { resourceId: resource.resourceId }
                : undefined,
          });
          return { resource, authorized };
        }),
      );
      checks.push(...batchChecks);
    }

    return checks.filter(c => c.authorized).map(c => c.resource);
  }

  // ──────────────────────────────────────────────────────────────
  // IFGAManager — Write operations
  // ──────────────────────────────────────────────────────────────

  /**
   * Create an authorization resource in WorkOS.
   */
  async createResource(params: FGACreateResourceParams): Promise<FGAResource> {
    const options: any = {
      externalId: params.externalId,
      name: params.name,
      resourceTypeSlug: params.resourceTypeSlug,
      organizationId: params.organizationId,
    };
    if (params.description !== undefined) options.description = params.description;
    if (params.parentResourceId) options.parentResourceId = params.parentResourceId;
    if (params.parentResourceExternalId) {
      options.parentResourceExternalId = params.parentResourceExternalId;
      options.parentResourceTypeSlug = params.parentResourceTypeSlug;
    }

    const result = await this.workos.authorization.createResource(options);
    return this.mapAuthorizationResource(result);
  }

  /**
   * Get an authorization resource by ID.
   */
  async getResource(resourceId: string): Promise<FGAResource> {
    const result = await this.workos.authorization.getResource(resourceId);
    return this.mapAuthorizationResource(result);
  }

  /**
   * List authorization resources with optional filters.
   */
  async listResources(options?: FGAListResourcesOptions): Promise<FGAResource[]> {
    const listOptions: any = {};
    if (options?.organizationId) listOptions.organizationId = options.organizationId;
    if (options?.resourceTypeSlug) listOptions.resourceTypeSlug = options.resourceTypeSlug;
    if (options?.parentResourceId) listOptions.parentResourceId = options.parentResourceId;
    if (options?.search) listOptions.search = options.search;
    if (options?.limit) listOptions.limit = options.limit;
    if (options?.after) listOptions.after = options.after;

    const result = await this.workos.authorization.listResources(listOptions);
    return result.data.map((r: any) => this.mapAuthorizationResource(r));
  }

  /**
   * Update an authorization resource.
   */
  async updateResource(params: FGAUpdateResourceParams): Promise<FGAResource> {
    const options: any = { resourceId: params.resourceId };
    if (params.name !== undefined) options.name = params.name;
    if (params.description !== undefined) options.description = params.description;

    const result = await this.workos.authorization.updateResource(options);
    return this.mapAuthorizationResource(result);
  }

  /**
   * Delete an authorization resource.
   */
  async deleteResource(params: FGADeleteResourceParams): Promise<void> {
    if ('resourceId' in params && params.resourceId) {
      await this.workos.authorization.deleteResource({ resourceId: params.resourceId });
    } else if ('externalId' in params && params.externalId && params.resourceTypeSlug) {
      await this.workos.authorization.deleteResourceByExternalId({
        externalId: params.externalId,
        resourceTypeSlug: params.resourceTypeSlug!,
        organizationId: params.organizationId!,
      });
    }
  }

  /**
   * Assign a role to an organization membership on a resource.
   */
  async assignRole(params: FGARoleParams): Promise<FGARoleAssignment> {
    const options: any = {
      organizationMembershipId: params.organizationMembershipId,
      roleSlug: params.roleSlug,
    };
    if (params.resourceId) options.resourceId = params.resourceId;
    if (params.resourceExternalId) {
      options.resourceExternalId = params.resourceExternalId;
      options.resourceTypeSlug = params.resourceTypeSlug;
    }

    const result = await this.workos.authorization.assignRole(options);
    return {
      id: result.id,
      role: result.role,
      resource: {
        id: result.resource.id,
        externalId: result.resource.externalId,
        resourceTypeSlug: result.resource.resourceTypeSlug,
      },
    };
  }

  /**
   * Remove a role assignment.
   */
  async removeRole(params: FGARoleParams): Promise<void> {
    const options: any = {
      organizationMembershipId: params.organizationMembershipId,
      roleSlug: params.roleSlug,
    };
    if (params.resourceId) options.resourceId = params.resourceId;
    if (params.resourceExternalId) {
      options.resourceExternalId = params.resourceExternalId;
      options.resourceTypeSlug = params.resourceTypeSlug;
    }

    await this.workos.authorization.removeRole(options);
  }

  /**
   * List role assignments for an organization membership.
   */
  async listRoleAssignments(options: FGAListRoleAssignmentsOptions): Promise<FGARoleAssignment[]> {
    const result = await this.workos.authorization.listRoleAssignments({
      organizationMembershipId: options.organizationMembershipId,
      ...(options.limit && { limit: options.limit }),
      ...(options.after && { after: options.after }),
    });

    return result.data.map((ra: any) => ({
      id: ra.id,
      role: ra.role,
      resource: {
        id: ra.resource.id,
        externalId: ra.resource.externalId,
        resourceTypeSlug: ra.resource.resourceTypeSlug,
      },
    }));
  }

  // ──────────────────────────────────────────────────────────────
  // Internal helpers
  // ──────────────────────────────────────────────────────────────

  /**
   * Resolve the organization membership ID from a user object.
   * Looks for organizationMembershipId, then finds membership matching
   * configured organizationId, then falls back to first membership.
   *
   * Returns undefined if no membership can be resolved, which causes
   * authorization checks to deny access. Enable `fetchMemberships: true`
   * on MastraAuthWorkos to populate the memberships field.
   */
  private resolveOrganizationMembershipId(
    user: WorkOSUser,
    options?: { strictMembershipResolution?: boolean },
  ): string | undefined {
    if (user?.organizationMembershipId) return user.organizationMembershipId;
    if (!user?.memberships?.length) {
      const loggerMsg =
        '[FGA] Cannot resolve organization membership for user. ' +
        'Ensure fetchMemberships is enabled on MastraAuthWorkos when using FGA.';
      const consoleMsg =
        '[MastraFGAWorkos] Cannot resolve organization membership for user <redacted>. ' +
        'Ensure fetchMemberships is enabled on MastraAuthWorkos when using FGA.';
      if (this.logger) {
        this.logger.warn(loggerMsg);
      } else {
        console.warn(consoleMsg);
      }
      if (options?.strictMembershipResolution) {
        throw new WorkOSFGAMembershipResolutionError(user);
      }
      return undefined;
    }

    // If organizationId is configured, find the matching membership
    if (this.organizationId) {
      const match = user.memberships.find(m => m.organizationId === this.organizationId);
      if (match) return match.id;

      if (this.logger) {
        this.logger.warn('[FGA] User does not belong to configured organization.');
      } else {
        console.warn('[MastraFGAWorkos] User <redacted> does not belong to configured organization <redacted>.');
      }
      if (options?.strictMembershipResolution) {
        throw new WorkOSFGAMembershipResolutionError(user);
      }
      return undefined;
    }

    // Fall back to first membership
    return user.memberships[0]!.id;
  }

  /**
   * Map a Mastra permission string to a WorkOS permission slug via permissionMapping.
   * Falls back to the original permission if no mapping is found.
   */
  private resolvePermission(permission: MastraFGAPermissionInput): string {
    return this.permissionMapping[permission] ?? permission;
  }

  /**
   * Resolve the parent resource context needed for WorkOS resource discovery.
   */
  private resolveParentResource(
    user: WorkOSUser,
    resourceType: string,
  ): { externalId: string; typeSlug: string } | undefined {
    const mapping = this.getResourceMapping(resourceType);
    const externalId = mapping?.deriveId?.({ user });
    const parentTypeSlug = mapping?.parentFgaResourceType ?? mapping?.parentResourceTypeSlug;
    if (!mapping?.fgaResourceType || !externalId || !parentTypeSlug || parentTypeSlug === mapping.fgaResourceType) {
      return undefined;
    }

    return {
      externalId,
      typeSlug: parentTypeSlug,
    };
  }

  /**
   * Resolve the FGA resource ID using resourceMapping's deriveId function.
   * Falls back to the original resource ID if no mapping is found.
   */
  private resolveResourceId(
    user: WorkOSUser,
    resourceType: string,
    resourceId: string,
    context?: FGACheckParams['context'],
  ): string | undefined {
    const mapping = this.getResourceMapping(resourceType);
    const derivedId = mapping?.deriveId?.({
      user,
      resourceId: context?.resourceId ?? resourceId,
      requestContext: context?.requestContext,
    });
    return derivedId ?? resourceId;
  }

  private buildCheckOptions(
    user: WorkOSUser,
    params: Omit<FGACheckParams, 'permission'> & { permission: MastraFGAPermissionInput },
    options?: { strictMembershipResolution?: boolean },
  ): any | null {
    const membershipId = this.resolveOrganizationMembershipId(user, options);
    if (!membershipId) return null;

    const permissionSlug = this.resolvePermission(params.permission);
    const resourceId = this.resolveResourceId(user, params.resource.type, params.resource.id, params.context);

    const checkOptions: any = {
      organizationMembershipId: membershipId,
      permissionSlug,
    };

    if (!resourceId) {
      return checkOptions;
    }

    const mapping = this.getResourceMapping(params.resource.type);
    if (mapping) {
      checkOptions.resourceExternalId = resourceId;
      checkOptions.resourceTypeSlug = mapping.fgaResourceType;
    } else {
      checkOptions.resourceExternalId = params.resource.id;
      checkOptions.resourceTypeSlug = params.resource.type;
    }

    return checkOptions;
  }

  private getResourceMapping(resourceType: string): FGAResourceMappingEntry | undefined {
    const aliases =
      resourceType === 'agent'
        ? ['agent', 'agents']
        : resourceType === 'workflow'
          ? ['workflow', 'workflows']
          : resourceType === 'tool'
            ? ['tool', 'tools']
            : resourceType === 'thread'
              ? ['thread', 'threads', 'memory']
              : [resourceType];

    for (const key of aliases) {
      const mapping = this.resourceMapping[key];
      if (mapping) {
        return mapping;
      }
    }

    return undefined;
  }

  /**
   * List accessible child resources for a membership, following pagination.
   */
  private async listAccessibleResourceExternalIds(params: {
    organizationMembershipId: string;
    permissionSlug: string;
    parentResourceExternalId: string;
    parentResourceTypeSlug: string;
  }): Promise<Set<string>> {
    const accessibleIds = new Set<string>();
    let after: string | undefined;

    do {
      const result: any = await this.workos.authorization.listResourcesForMembership({
        organizationMembershipId: params.organizationMembershipId,
        permissionSlug: params.permissionSlug,
        parentResourceExternalId: params.parentResourceExternalId,
        parentResourceTypeSlug: params.parentResourceTypeSlug,
        ...(after ? { after } : {}),
        limit: 100,
        order: 'asc',
      });

      for (const resource of result.data ?? []) {
        if (typeof resource?.externalId === 'string') {
          accessibleIds.add(resource.externalId);
        }
      }

      after = result.listMetadata?.after ?? undefined;
    } while (after);

    return accessibleIds;
  }

  /**
   * Map a WorkOS AuthorizationResource to Mastra's FGAResource type.
   */
  private mapAuthorizationResource(resource: any): FGAResource {
    return {
      id: resource.id,
      externalId: resource.externalId,
      name: resource.name,
      description: resource.description,
      resourceTypeSlug: resource.resourceTypeSlug,
      organizationId: resource.organizationId,
      parentResourceId: resource.parentResourceId,
    };
  }

  // ──────────────────────────────────────────────────────────────
  // Resource Type Discovery (Alida's workaround)
  // ──────────────────────────────────────────────────────────────

  /**
   * Discover resource types from WorkOS by combining roles and resources data.
   *
   * This uses a workaround since WorkOS doesn't expose a direct schema API:
   * - Roles grouped by resourceTypeSlug give us types and their relations
   * - Resources with parentResourceId give us hierarchy information
   *
   * Caveats:
   * - Types with no roles AND no instances won't appear
   * - Parent type derivation depends on existing instances
   * - Relations are role slugs, not OpenFGA-style relation tuples
   *
   * Results are cached for 1 minute to reduce API calls.
   */
  async describeResourceTypes(organizationId: string): Promise<FGAResourceTypeInfo[]> {
    // Check cache first (keyed by organizationId to avoid cross-org data leakage)
    const cached = this.resourceTypesCache.get(organizationId);
    if (cached && Date.now() - cached.timestamp < this.RESOURCE_TYPES_CACHE_TTL) {
      return cached.types;
    }

    // Fetch all resources (paginated)
    const allResources: any[] = [];
    let resourcesAfter: string | undefined;
    do {
      const result = await this.workos.authorization.listResources({
        organizationId,
        limit: 100,
        after: resourcesAfter,
      });
      allResources.push(...(result.data ?? []));
      resourcesAfter = result.listMetadata?.after ?? undefined;
    } while (resourcesAfter);

    // Fetch all roles for the organization
    const { data: roles } = await this.workos.authorization.listOrganizationRoles(organizationId);

    // Build resource type map
    const types = new Map<
      string,
      {
        slug: string;
        relations: Set<string>;
        customRelations: Set<string>;
        parentResourceTypeSlugs: Set<string>;
        hasInstances: boolean;
      }
    >();

    const ensure = (slug: string) => {
      if (!types.has(slug)) {
        types.set(slug, {
          slug,
          relations: new Set(),
          customRelations: new Set(),
          parentResourceTypeSlugs: new Set(),
          hasInstances: false,
        });
      }
      return types.get(slug)!;
    };

    // Derive resource types and relations from roles
    for (const role of roles) {
      const entry = ensure(role.resourceTypeSlug);
      entry.relations.add(role.slug);
      // OrganizationRole = custom org-specific role
      if (role.type === 'OrganizationRole') {
        entry.customRelations.add(role.slug);
      }
    }

    // Derive parent types from resource instances
    const idToTypeSlug = new Map(allResources.map(r => [r.id, r.resourceTypeSlug]));
    for (const resource of allResources) {
      const entry = ensure(resource.resourceTypeSlug);
      entry.hasInstances = true;
      if (resource.parentResourceId) {
        const parentSlug = idToTypeSlug.get(resource.parentResourceId);
        if (parentSlug) {
          entry.parentResourceTypeSlugs.add(parentSlug);
        }
      }
    }

    // Convert to array format and cache
    const result = [...types.values()].map(t => ({
      slug: t.slug,
      relations: [...t.relations],
      customRelations: [...t.customRelations],
      parentResourceTypeSlugs: [...t.parentResourceTypeSlugs],
      hasInstances: t.hasInstances,
    }));

    // Cache the result (keyed by organizationId)
    this.resourceTypesCache.set(organizationId, { types: result, timestamp: Date.now() });

    return result;
  }

  // ──────────────────────────────────────────────────────────────
  // Authorship Support
  // ──────────────────────────────────────────────────────────────

  /**
   * Check if a resource type exists in the FGA schema (cached).
   */
  async hasResourceType(organizationId: string, resourceTypeSlug: string): Promise<boolean> {
    const types = await this.describeResourceTypes(organizationId);
    return types.some(t => t.slug === resourceTypeSlug);
  }

  /**
   * Register a Mastra resource in FGA with optional ownership support.
   *
   * This method:
   * 1. Translates resourceType via resourceMapping (if configured)
   * 2. Checks if the resource type exists in WorkOS
   * 3. Creates the FGA resource (with optional parent for hierarchy)
   * 4. Auto-assigns the owner role if ownership is enabled
   *
   * @returns Registration result with resource, owner assignment, and warnings
   */
  async registerResource(params: FGARegisterResourceParams<WorkOSUser>): Promise<FGARegistrationResult> {
    const { user, resourceType: inputResourceType, resourceId, name, parentResource, skipOwnership } = params;
    const warnings: string[] = [];

    // Translate resourceType via resourceMapping (if configured)
    // e.g., 'agent' might map to 'team' in WorkOS FGA
    const mapping = this.getResourceMapping(inputResourceType);
    const resourceType = mapping?.fgaResourceType ?? inputResourceType;

    // Get organization ID from user or provider config
    const organizationId = user.organizationId || this.organizationId;
    if (!organizationId) {
      warnings.push(
        `Cannot register resource: no organizationId available. ` +
          `Ensure user has organizationId set or FGA provider has organizationId configured.`,
      );
      return { resource: null, ownerAssignment: null, warnings };
    }

    // 1. Check if resource type exists in WorkOS
    const types = await this.describeResourceTypes(organizationId);
    const typeInfo = types.find(t => t.slug === resourceType);

    if (!typeInfo) {
      warnings.push(
        `Resource type '${resourceType}' not found in WorkOS (or has no roles defined). ` +
          `Resource '${name}' will be publicly accessible (no FGA protection). ` +
          `To enable protection, create '${resourceType}' resource type with roles in WorkOS Dashboard.`,
      );
      this.logger?.warn(`[FGA] ${warnings[warnings.length - 1]}`);
      return { resource: null, ownerAssignment: null, warnings };
    }

    // 2. Resolve parent resource ID if hierarchical
    let parentResourceId: string | undefined;
    if (parentResource) {
      const parentTypeInfo = types.find(t => t.slug === parentResource.type);
      if (parentTypeInfo) {
        // Look up the parent's FGA resource by externalId
        const parentResources = await this.listResources({
          organizationId,
          resourceTypeSlug: parentResource.type,
        });
        const parent = parentResources.find(r => r.externalId === parentResource.id);
        parentResourceId = parent?.id;

        if (!parentResourceId) {
          warnings.push(
            `Parent ${parentResource.type} '${parentResource.id}' not found in FGA. ` +
              `Resource will be created without parent hierarchy.`,
          );
          this.logger?.warn(`[FGA] ${warnings[warnings.length - 1]}`);
        }
      } else {
        warnings.push(
          `Parent resource type '${parentResource.type}' not found in WorkOS. ` +
            `Resource will be created without parent hierarchy.`,
        );
        this.logger?.warn(`[FGA] ${warnings[warnings.length - 1]}`);
      }
    }

    // 3. Create the FGA resource
    const resource = await this.createResource({
      resourceTypeSlug: resourceType,
      externalId: resourceId,
      name,
      organizationId,
      parentResourceId,
    });

    // 4. Auto-assign owner role (if enabled and role exists)
    let ownerAssignment: FGARoleAssignment | null = null;

    if (!skipOwnership && this.ownership?.enabled) {
      const membershipId = this.resolveOrganizationMembershipId(user);
      if (!membershipId) {
        warnings.push(
          `Cannot assign owner role: no organization membership ID found for user. ` +
            `Ensure fetchMemberships is enabled on MastraAuthWorkos.`,
        );
        this.logger?.warn(`[FGA] ${warnings[warnings.length - 1]}`);
      } else {
        // Find a suitable role to assign
        const ownerRoleName = this.ownership.ownerRole;
        const hasOwnerRole = typeInfo.relations.includes(ownerRoleName);

        if (hasOwnerRole) {
          // Assign the configured owner role
          ownerAssignment = await this.assignRole({
            organizationMembershipId: membershipId,
            resourceId: resource.id,
            resourceTypeSlug: resourceType,
            roleSlug: ownerRoleName,
          });

          this.logger?.info(
            `[FGA] Registered ${resourceType} '${name}' with '${ownerRoleName}' role assigned to user.`,
          );
        } else {
          // Try fallback roles
          const fallbackRole = this.ownership.fallbackRoles.find((r: string) => typeInfo.relations.includes(r));

          if (fallbackRole) {
            ownerAssignment = await this.assignRole({
              organizationMembershipId: membershipId,
              resourceId: resource.id,
              resourceTypeSlug: resourceType,
              roleSlug: fallbackRole,
            });

            warnings.push(
              `Role '${ownerRoleName}' not found for '${resourceType}'. ` + `Using '${fallbackRole}' instead.`,
            );
            this.logger?.warn(`[FGA] ${warnings[warnings.length - 1]}`);
            this.logger?.info(
              `[FGA] Registered ${resourceType} '${name}' with '${fallbackRole}' role assigned to user.`,
            );
          } else {
            warnings.push(
              `No owner role found for '${resourceType}'. ` +
                `Available roles: ${typeInfo.relations.join(', ')}. ` +
                `User will not have automatic access to their created resource.`,
            );
            this.logger?.warn(`[FGA] ${warnings[warnings.length - 1]}`);
          }
        }
      }
    }

    return { resource, ownerAssignment, warnings };
  }
}
