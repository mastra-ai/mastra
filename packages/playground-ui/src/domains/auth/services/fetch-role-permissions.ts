import type { MastraClient, RouteResponse } from '@mastra/client-js';

type RolePermissionsResponse = RouteResponse<'GET /auth/roles/:roleId/permissions'>;

/**
 * Makes a request to fetch the resolved permissions for a role.
 * Exported for testing purposes.
 *
 * @internal
 */
export async function fetchRolePermissionsRequest(
  client: MastraClient,
  { roleId }: { roleId: string },
): Promise<RolePermissionsResponse> {
  const { baseUrl = '', apiPrefix, headers: clientHeaders = {} } = client.options || {};
  const raw = (apiPrefix ?? '/api').trim();
  const normalized = raw === '' ? '' : raw.startsWith('/') ? raw : `/${raw}`;
  const prefix = normalized.replace(/\/+$/, '');

  const response = await fetch(`${baseUrl}${prefix}/auth/roles/${encodeURIComponent(roleId)}/permissions`, {
    credentials: 'include',
    headers: {
      ...clientHeaders,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch role permissions: ${response.status}`);
  }

  return response.json();
}
