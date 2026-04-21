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
  FGACreateResourceParams,
  FGAUpdateResourceParams,
  FGADeleteResourceParams,
  FGAListResourcesOptions,
  FGARoleAssignment,
  FGARoleParams,
  FGAListRoleAssignmentsOptions,
} from '@mastra/core/auth/ee';
import { FGADeniedError } from '@mastra/core/auth/ee';
import { WorkOS } from '@workos-inc/node';

import type { MastraFGAWorkosOptions, FGAResourceMappingEntry, WorkOSUser } from './types';

export class WorkOSFGAMembershipResolutionError extends Error {
  readonly status = 500;
  readonly userId?: string;

  constructor(user: WorkOSUser) {
    super(
      `[MastraFGAWorkos] Cannot resolve organization membership for user ${user?.id ?? 'unknown'}. ` +
        'Ensure fetchMemberships is enabled on MastraAuthWorkos or provide organizationMembershipId on the user.',
    );
    this.name = 'WorkOSFGAMembershipResolutionError';
    this.userId = user?.id;
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
 *
 * const fga = new MastraFGAWorkos({
 *   resourceMapping: {
 *     agents: { fgaResourceType: 'team', deriveId: (ctx) => ctx.user.teamId },
 *     workflows: { fgaResourceType: 'team', deriveId: (ctx) => ctx.user.teamId },
 *     memory: { fgaResourceType: 'user', deriveId: (ctx) => ctx.user.userId },
 *   },
 *   permissionMapping: {
 *     'agents:execute': 'manage-workflows',
 *     'workflows:execute': 'manage-workflows',
 *     'memory:read': 'read',
 *     'memory:write': 'update',
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
  }

  // ──────────────────────────────────────────────────────────────
  // IFGAProvider — Read-only checks
  // ──────────────────────────────────────────────────────────────

  /**
   * Check if a user has permission on a resource.
   *
   * Resolves the user's organization membership ID, maps the permission
   * via `permissionMapping`, and delegates to `workos.authorization.check()`.
   */
  async check(user: WorkOSUser, params: FGACheckParams): Promise<boolean> {
    const checkOptions = this.buildCheckOptions(user, params);
    if (!checkOptions) return false;
    const result = await this.workos.authorization.check(checkOptions);
    return result.authorized;
  }

  /**
   * Require that a user has permission, throwing FGADeniedError if not.
   */
  async require(user: WorkOSUser, params: FGACheckParams): Promise<void> {
    const checkOptions = this.buildCheckOptions(user, params, { strictMembershipResolution: true });
    if (!checkOptions) {
      throw new FGADeniedError(user, params.resource, params.permission);
    }

    const result = await this.workos.authorization.check(checkOptions);
    if (!result.authorized) {
      throw new FGADeniedError(user, params.resource, params.permission);
    }
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
    permission: string,
  ): Promise<T[]> {
    if (resources.length === 0) return [];

    const membershipId = this.resolveOrganizationMembershipId(user);
    if (!membershipId) return [];

    const permissionSlug = this.resolvePermission(permission);
    const parentResource = this.resolveParentResource(user, resourceType);
    if (parentResource) {
      const accessibleIds = await this.listAccessibleResourceExternalIds({
        organizationMembershipId: membershipId,
        permissionSlug,
        parentResourceExternalId: parentResource.externalId,
        parentResourceTypeSlug: parentResource.typeSlug,
      });

      return resources.filter(resource => accessibleIds.has(resource.id));
    }

    const checks = await Promise.all(
      resources.map(async resource => {
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
      console.warn(
        '[MastraFGAWorkos] Cannot resolve organization membership for user %s. ' +
          'Ensure fetchMemberships is enabled on MastraAuthWorkos when using FGA.',
        user?.id ?? 'unknown',
      );
      if (options?.strictMembershipResolution) {
        throw new WorkOSFGAMembershipResolutionError(user);
      }
      return undefined;
    }

    // If organizationId is configured, find the matching membership
    if (this.organizationId) {
      const match = user.memberships.find(m => m.organizationId === this.organizationId);
      if (match) return match.id;

      console.warn(
        '[MastraFGAWorkos] User %s does not belong to configured organization %s.',
        user?.id ?? 'unknown',
        this.organizationId,
      );
      return undefined;
    }

    // Fall back to first membership
    return user.memberships[0]!.id;
  }

  /**
   * Map a Mastra permission string to a WorkOS permission slug via permissionMapping.
   * Falls back to the original permission if no mapping is found.
   */
  private resolvePermission(permission: string): string {
    return this.permissionMapping[permission] ?? permission;
  }

  /**
   * Resolve the parent resource context needed for WorkOS resource discovery.
   */
  private resolveParentResource(
    user: WorkOSUser,
    resourceType: string,
  ): { externalId: string; typeSlug: string } | undefined {
    const mapping = this.resourceMapping[resourceType];
    const externalId = mapping?.deriveId?.({ user });
    if (!mapping?.fgaResourceType || !externalId) {
      return undefined;
    }

    return {
      externalId,
      typeSlug: mapping.fgaResourceType,
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
    const mapping = this.resourceMapping[resourceType];
    const derivedId = mapping?.deriveId?.({
      user,
      resourceId: context?.resourceId ?? resourceId,
      requestContext: context?.requestContext,
    });
    return derivedId ?? resourceId;
  }

  private buildCheckOptions(
    user: WorkOSUser,
    params: FGACheckParams,
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

    const mapping = this.resourceMapping[params.resource.type];
    if (mapping) {
      checkOptions.resourceExternalId = resourceId;
      checkOptions.resourceTypeSlug = mapping.fgaResourceType;
    } else {
      checkOptions.resourceExternalId = params.resource.id;
      checkOptions.resourceTypeSlug = params.resource.type;
    }

    return checkOptions;
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
}
