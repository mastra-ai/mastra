/**
 * Hooks for FGA share functionality.
 *
 * Provides React Query hooks for:
 * - Listing users who have access to a resource
 * - Listing available roles for a resource type
 * - Assigning access to users
 * - Removing access from users
 *
 * Uses existing auth-vnext API routes:
 * - GET /auth/fga/resources/:resourceId/assignments
 * - POST /auth/fga/resources/:resourceId/assignments
 * - DELETE /auth/fga/resources/:resourceId/assignments/:assignmentId
 * - GET /auth/fga/resource-types/:resourceTypeSlug/roles
 */

import type { MastraClient } from '@mastra/client-js';
import { useMastraClient } from '@mastra/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// ============================================================================
// Types
// ============================================================================

// Matches FGAResourceAssignment from auth-vnext
export interface FGAAccessEntry {
  id: string;
  role: string;
  organizationMembershipId: string;
  user?: {
    id: string;
    email?: string;
    firstName?: string;
    lastName?: string;
  };
}

export interface FGARole {
  slug: string;
  name?: string;
  description?: string;
}

export interface FGAResourceAccessResponse {
  assignments: FGAAccessEntry[];
  resourceId: string | null; // WorkOS internal resource ID for use in assign/remove operations
}

export interface FGAResourceRolesResponse {
  roles: FGARole[];
}

export interface FGAAssignAccessParams {
  resourceType: string; // For query invalidation (e.g., 'agent')
  externalResourceId: string; // External resource ID for query invalidation (e.g., 'my-agent')
  resourceId: string; // WorkOS internal resource ID (authz_resource_...)
  membershipId: string;
  roleSlug: string;
}

export interface FGARemoveAccessParams {
  resourceType: string; // For query invalidation (e.g., 'agent')
  externalResourceId: string; // External resource ID for query invalidation (e.g., 'my-agent')
  resourceId: string; // WorkOS internal resource ID (authz_resource_...)
  assignmentId: string;
  roleSlug: string;
}

export interface OrgMember {
  membershipId: string;
  userId?: string;
  email?: string;
  name?: string;
}

export interface OrgMembersResponse {
  members: OrgMember[];
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Fetch role assignments for a resource.
 * Uses: GET /auth/fga/resources/:resourceType/:resourceId/assignments
 */
async function fetchResourceAccess(
  client: MastraClient,
  resourceType: string,
  resourceId: string,
): Promise<FGAResourceAccessResponse> {
  const { baseUrl = '', headers: clientHeaders = {}, apiPrefix } = client.options;
  const raw = (apiPrefix || '/api').trim();
  const prefix = (raw.startsWith('/') ? raw : `/${raw}`).replace(/\/$/, '');

  // Pass resourceType and resourceId (external ID) - backend looks up WorkOS internal ID
  const response = await fetch(
    `${baseUrl}${prefix}/auth/fga/resources/${encodeURIComponent(resourceType)}/${encodeURIComponent(resourceId)}/assignments`,
    {
      credentials: 'include',
      headers: {
        ...clientHeaders,
        'Content-Type': 'application/json',
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch resource access: ${response.status}`);
  }

  return response.json();
}

/**
 * Fetch available roles for a resource type.
 * Uses: GET /auth/fga/resource-types/:resourceTypeSlug/roles
 */
async function fetchResourceTypeRoles(client: MastraClient, resourceType: string): Promise<FGAResourceRolesResponse> {
  const { baseUrl = '', headers: clientHeaders = {}, apiPrefix } = client.options;
  const raw = (apiPrefix || '/api').trim();
  const prefix = (raw.startsWith('/') ? raw : `/${raw}`).replace(/\/$/, '');

  const response = await fetch(
    `${baseUrl}${prefix}/auth/fga/resource-types/${encodeURIComponent(resourceType)}/roles`,
    {
      credentials: 'include',
      headers: {
        ...clientHeaders,
        'Content-Type': 'application/json',
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch resource type roles: ${response.status}`);
  }

  return response.json();
}

/**
 * Assign a role to a user on a resource.
 * Uses: POST /auth/fga/resources/:resourceId/assignments
 * Note: resourceId must be the WorkOS internal ID (authz_resource_...)
 */
async function assignAccess(client: MastraClient, params: FGAAssignAccessParams): Promise<void> {
  const { baseUrl = '', headers: clientHeaders = {}, apiPrefix } = client.options;
  const raw = (apiPrefix || '/api').trim();
  const prefix = (raw.startsWith('/') ? raw : `/${raw}`).replace(/\/$/, '');

  // resourceId is the WorkOS internal ID returned from fetchResourceAccess
  const response = await fetch(
    `${baseUrl}${prefix}/auth/fga/resources/${encodeURIComponent(params.resourceId)}/assignments`,
    {
      method: 'POST',
      credentials: 'include',
      headers: {
        ...clientHeaders,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        organizationMembershipId: params.membershipId,
        roleSlug: params.roleSlug,
      }),
    },
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error(error.message || `Failed to assign access: ${response.status}`);
  }
}

/**
 * Fetch organization members for user search.
 * Uses: GET /auth/team (team members endpoint)
 */
async function fetchOrganizationMembers(client: MastraClient, search?: string): Promise<OrgMembersResponse> {
  const { baseUrl = '', headers: clientHeaders = {}, apiPrefix } = client.options;
  const raw = (apiPrefix || '/api').trim();
  const prefix = (raw.startsWith('/') ? raw : `/${raw}`).replace(/\/$/, '');

  const url = new URL(`${baseUrl}${prefix}/auth/team`);
  if (search) {
    url.searchParams.set('search', search);
  }

  const response = await fetch(url.toString(), {
    credentials: 'include',
    headers: {
      ...clientHeaders,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch organization members: ${response.status}`);
  }

  const data = await response.json();
  // Map team response to org members format
  // Team endpoint returns { users: [...] } not { members: [...] }
  const users = data.users || data.members || [];
  return {
    members: users.map((m: any) => ({
      membershipId: m.membershipId || m.id,
      userId: m.id,
      email: m.email,
      name: m.name,
    })),
  };
}

/**
 * Remove a role assignment from a resource.
 * Uses: DELETE /auth/fga/resources/:resourceId/assignments/:assignmentId
 * Note: resourceId must be the WorkOS internal ID (authz_resource_...)
 */
async function removeAccess(client: MastraClient, params: FGARemoveAccessParams): Promise<void> {
  const { baseUrl = '', headers: clientHeaders = {}, apiPrefix } = client.options;
  const raw = (apiPrefix || '/api').trim();
  const prefix = (raw.startsWith('/') ? raw : `/${raw}`).replace(/\/$/, '');

  // resourceId is the WorkOS internal ID returned from fetchResourceAccess
  const response = await fetch(
    `${baseUrl}${prefix}/auth/fga/resources/${encodeURIComponent(params.resourceId)}/assignments/${encodeURIComponent(params.assignmentId)}`,
    {
      method: 'DELETE',
      credentials: 'include',
      headers: {
        ...clientHeaders,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        roleSlug: params.roleSlug,
      }),
    },
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error(error.message || `Failed to remove access: ${response.status}`);
  }
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook to fetch users who have access to a specific resource.
 *
 * @param resourceType - The type of resource (e.g., 'agent', 'workflow')
 * @param resourceId - The resource's ID (e.g., 'my-agent')
 * @returns Query result with access entries
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useResourceAccess('agent', 'my-agent');
 * ```
 */
export function useResourceAccess(resourceType: string, resourceId: string) {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['fga', 'access', resourceType, resourceId],
    queryFn: () => fetchResourceAccess(client, resourceType, resourceId),
    enabled: !!resourceType && !!resourceId,
  });
}

/**
 * Hook to fetch available roles for a resource type.
 *
 * @param resourceType - The type of resource (e.g., 'agent', 'workflow')
 * @returns Query result with available roles
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useResourceTypeRoles('agent');
 * ```
 */
export function useResourceTypeRoles(resourceType: string) {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['fga', 'roles', resourceType],
    queryFn: () => fetchResourceTypeRoles(client, resourceType),
    enabled: !!resourceType,
    staleTime: 5 * 60 * 1000, // Cache roles for 5 minutes
  });
}

/**
 * Hook to assign access to a user on a resource.
 *
 * @returns Mutation for assigning access
 *
 * @example
 * ```tsx
 * const { mutate: assign, isPending } = useAssignAccess();
 *
 * assign({
 *   resourceId: 'res_abc123',
 *   membershipId: 'om_xyz',
 *   roleSlug: 'agent-viewer',
 * });
 * ```
 */
export function useAssignAccess() {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: FGAAssignAccessParams) => assignAccess(client, params),
    onSuccess: (_, params) => {
      // Invalidate the access list for this resource (using external ID for query key)
      void queryClient.invalidateQueries({
        queryKey: ['fga', 'access', params.resourceType, params.externalResourceId],
      });
    },
  });
}

/**
 * Hook to remove access from a user on a resource.
 *
 * @returns Mutation for removing access
 *
 * @example
 * ```tsx
 * const { mutate: remove, isPending } = useRemoveAccess();
 *
 * remove({
 *   resourceId: 'res_abc123',
 *   assignmentId: 'assign_xyz',
 * });
 * ```
 */
export function useRemoveAccess() {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: FGARemoveAccessParams) => removeAccess(client, params),
    onSuccess: (_, params) => {
      // Invalidate the access list for this resource (using external ID for query key)
      void queryClient.invalidateQueries({
        queryKey: ['fga', 'access', params.resourceType, params.externalResourceId],
      });
    },
  });
}

/**
 * Hook to fetch organization members for user search.
 *
 * @param search - Optional search term to filter members
 * @returns Query result with organization members
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useOrganizationMembers('alice');
 * ```
 */
export function useOrganizationMembers(search?: string) {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['org', 'members', search || ''],
    queryFn: () => fetchOrganizationMembers(client, search),
    staleTime: 30 * 1000, // Cache for 30 seconds
  });
}
