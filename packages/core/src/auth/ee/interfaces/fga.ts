/**
 * FGA (Fine-Grained Authorization) provider interface for EE authentication.
 * Enables relationship-based, resource-level authorization.
 *
 * FGA complements RBAC by answering "Can this user do this action on this specific resource?"
 * rather than "Can this role do this action?"
 *
 * @license Mastra Enterprise License - see ee/LICENSE
 */

// ──────────────────────────────────────────────────────────────
// Core Types
// ──────────────────────────────────────────────────────────────

import type { RequestContext } from '../../../di';
import type { MastraFGAPermissionInput } from './permissions.generated';

/**
 * Optional context for an authorization check.
 */
export interface FGACheckContext {
  /**
   * The owning application resource ID for the target resource.
   * Useful when the authorization resource ID differs from the route-level ID,
   * such as thread checks scoped by a thread's owning tenant/resource.
   */
  resourceId?: string;
  /**
   * Optional request context for providers that need additional request-scoped
   * data to derive the authorization resource identifier.
   */
  requestContext?: RequestContext;
}

/**
 * Parameters for an authorization check.
 */
export interface FGACheckParams {
  /** The resource being accessed */
  resource: { type: string; id: string };
  /** The permission being checked */
  permission: MastraFGAPermissionInput;
  /** Optional provider-specific context for resource resolution */
  context?: FGACheckContext;
}

/**
 * An authorization resource in the FGA system.
 */
export interface FGAResource {
  /** Internal resource ID */
  id: string;
  /** External ID (your application's resource identifier) */
  externalId: string;
  /** Display name */
  name: string;
  /** Optional description */
  description?: string | null;
  /** Resource type slug (e.g., 'team', 'project', 'workspace') */
  resourceTypeSlug: string;
  /** Organization ID the resource belongs to */
  organizationId: string;
  /** Parent resource ID for hierarchical resources */
  parentResourceId?: string | null;
}

/**
 * Parameters for creating an authorization resource.
 */
export interface FGACreateResourceParams {
  /** External ID (your application's resource identifier) */
  externalId: string;
  /** Display name */
  name: string;
  /** Optional description */
  description?: string | null;
  /** Resource type slug */
  resourceTypeSlug: string;
  /** Organization ID */
  organizationId: string;
  /** Parent resource ID (by internal ID) */
  parentResourceId?: string;
  /** Parent resource external ID (alternative to parentResourceId) */
  parentResourceExternalId?: string;
  /** Parent resource type slug (required with parentResourceExternalId) */
  parentResourceTypeSlug?: string;
}

/**
 * Parameters for updating an authorization resource.
 */
export interface FGAUpdateResourceParams {
  /** Internal resource ID */
  resourceId: string;
  /** New name */
  name?: string;
  /** New description */
  description?: string | null;
}

/**
 * Parameters for deleting an authorization resource.
 */
export interface FGADeleteResourceParams {
  /** Delete by internal resource ID */
  resourceId?: string;
  /** Delete by external ID (use with resourceTypeSlug and organizationId) */
  externalId?: string;
  /** Resource type slug (required when using externalId) */
  resourceTypeSlug?: string;
  /** Organization ID (required when using externalId) */
  organizationId?: string;
}

/**
 * A role assignment binding a membership to a role on a resource.
 */
export interface FGARoleAssignment {
  /** Assignment ID */
  id: string;
  /** The role */
  role: { slug: string };
  /** The resource the role is assigned on */
  resource: { id: string; externalId: string; resourceTypeSlug: string };
}

/**
 * Parameters for assigning or removing a role on a resource.
 */
export interface FGARoleParams {
  /** Organization membership ID */
  organizationMembershipId: string;
  /** Role slug to assign/remove */
  roleSlug: string;
  /** Resource ID to scope the role to */
  resourceId?: string;
  /** Resource external ID (alternative to resourceId) */
  resourceExternalId?: string;
  /** Resource type slug (required when using resourceExternalId) */
  resourceTypeSlug?: string;
}

/**
 * Options for listing role assignments.
 */
export interface FGAListRoleAssignmentsOptions {
  /** Organization membership ID */
  organizationMembershipId: string;
  /** Pagination limit */
  limit?: number;
  /** Pagination cursor */
  after?: string;
}

/**
 * Options for listing authorization resources.
 */
export interface FGAListResourcesOptions {
  /** Filter by organization */
  organizationId?: string;
  /** Filter by resource type */
  resourceTypeSlug?: string;
  /** Filter by parent resource */
  parentResourceId?: string;
  /** Search by name */
  search?: string;
  /** Pagination limit */
  limit?: number;
  /** Pagination cursor */
  after?: string;
}

// ──────────────────────────────────────────────────────────────
// Provider Interface (read-only checks)
// ──────────────────────────────────────────────────────────────

/**
 * Provider interface for fine-grained authorization (read-only).
 *
 * This interface follows a user-centric model:
 * - `check()` answers "Can this user perform this permission on this resource?"
 * - `require()` throws if the user lacks permission
 * - `filterAccessible()` filters a list of resources to only those the user can access
 *
 * The provider is responsible for translating between Mastra's resource/permission
 * model and the underlying FGA provider's API (e.g., WorkOS Authorization).
 *
 * @example
 * ```typescript
 * import { MastraFGAPermissions } from '@mastra/core/auth/ee';
 *
 * const fga = new MastraFGAWorkos({
 *   resourceMapping: {
 *     agents: { fgaResourceType: 'team', deriveId: (ctx) => ctx.user.teamId },
 *     workflows: { fgaResourceType: 'team', deriveId: (ctx) => ctx.user.teamId },
 *     memory: { fgaResourceType: 'user', deriveId: (ctx) => ctx.user.userId },
 *   },
 *   permissionMapping: {
 *     [MastraFGAPermissions.AGENTS_READ]: 'read',
 *     [MastraFGAPermissions.AGENTS_EXECUTE]: 'manage-workflows',
 *     [MastraFGAPermissions.WORKFLOWS_EXECUTE]: 'manage-workflows',
 *     [MastraFGAPermissions.MEMORY_READ]: 'read',
 *     [MastraFGAPermissions.MEMORY_WRITE]: 'update',
 *   },
 * });
 *
 * // Check if a user can execute an agent
 * const allowed = await fga.check(user, {
 *   resource: { type: 'agent', id: 'chef-agent' },
 *   permission: MastraFGAPermissions.AGENTS_EXECUTE,
 * });
 * ```
 */
export interface IFGAProvider<TUser = unknown> {
  /**
   * Check if a user has a specific permission on a resource.
   *
   * @param user - The user to check
   * @param params - The resource and permission to check
   * @returns true if the user has permission, false otherwise
   */
  check(user: TUser, params: FGACheckParams): Promise<boolean>;

  /**
   * Require that a user has a specific permission on a resource.
   * Throws FGADeniedError if the user does not have permission.
   *
   * @param user - The user to check
   * @param params - The resource and permission to check
   * @throws FGADeniedError if the user does not have permission
   */
  require(user: TUser, params: FGACheckParams): Promise<void>;

  /**
   * Filter a list of resources to only those the user can access.
   *
   * @param user - The user to check
   * @param resources - The resources to filter
   * @param resourceType - The type of resources being filtered
   * @param permission - The permission to check for
   * @returns The filtered list of resources the user can access
   */
  filterAccessible<T extends { id: string }>(
    user: TUser,
    resources: T[],
    resourceType: string,
    permission: MastraFGAPermissionInput,
  ): Promise<T[]>;
}

// ──────────────────────────────────────────────────────────────
// Manager Interface (read + write operations)
// ──────────────────────────────────────────────────────────────

/**
 * Extended FGA interface with write operations for managing resources and role assignments.
 *
 * Implement this interface when the FGA provider also manages the authorization
 * model (creating resources, assigning roles, etc.).
 */
export interface IFGAManager<TUser = unknown> extends IFGAProvider<TUser> {
  /**
   * Create an authorization resource.
   */
  createResource(params: FGACreateResourceParams): Promise<FGAResource>;

  /**
   * Get an authorization resource by ID.
   */
  getResource(resourceId: string): Promise<FGAResource>;

  /**
   * List authorization resources.
   */
  listResources(options?: FGAListResourcesOptions): Promise<FGAResource[]>;

  /**
   * Update an authorization resource.
   */
  updateResource(params: FGAUpdateResourceParams): Promise<FGAResource>;

  /**
   * Delete an authorization resource.
   */
  deleteResource(params: FGADeleteResourceParams): Promise<void>;

  /**
   * Assign a role to an organization membership on a specific resource.
   */
  assignRole(params: FGARoleParams): Promise<FGARoleAssignment>;

  /**
   * Remove a role assignment.
   */
  removeRole(params: FGARoleParams): Promise<void>;

  /**
   * List role assignments for an organization membership.
   */
  listRoleAssignments(options: FGAListRoleAssignmentsOptions): Promise<FGARoleAssignment[]>;
}
