import type { MastraClient, RouteResponse } from '@mastra/client-js';

type RolePermissionsResponse = RouteResponse<'GET /auth/roles/:roleId/permissions'>;

/**
 * Makes a request to fetch the resolved permissions for a role. Goes through
 * `client.request` so the client's `fetch` override, headers, and credentials apply.
 * Exported for testing purposes.
 *
 * @internal
 */
export function fetchRolePermissionsRequest(
  client: MastraClient,
  { roleId }: { roleId: string },
): Promise<RolePermissionsResponse> {
  return client.request<RolePermissionsResponse>(`/auth/roles/${encodeURIComponent(roleId)}/permissions`);
}
