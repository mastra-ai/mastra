import type { RouteResponse } from '@mastra/client-js';

type RolePermissionsResponse = RouteResponse<'GET /auth/roles/:roleId/permissions'>;

export const adminPermissions: RolePermissionsResponse = {
  roleId: 'admin',
  permissions: ['*'],
};

export const viewerPermissions: RolePermissionsResponse = {
  roleId: 'viewer',
  permissions: ['agents:read', 'tools:read'],
};

export const emptyPermissions: RolePermissionsResponse = {
  roleId: 'restricted',
  permissions: [],
};
