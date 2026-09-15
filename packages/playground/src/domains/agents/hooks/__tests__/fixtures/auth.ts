import type { AuthCapabilities } from '@/domains/auth/types';

/**
 * RBAC disabled → `usePermissions` allows everything, so
 * `hasPermission('workspaces:write')` is true and workspace writes run.
 */
export const writeAllowedCapabilities = {
  enabled: false,
  login: null,
} satisfies AuthCapabilities;

/**
 * RBAC enabled with no granted permissions → `hasPermission('workspaces:write')`
 * is false, so the workspace-write step is skipped.
 */
export const writeDeniedCapabilities = {
  enabled: true,
  login: null,
  user: { id: 'user-1' },
  capabilities: {
    user: true,
    session: true,
    sso: false,
    rbac: true,
    acl: false,
  },
  access: {
    roles: ['viewer'],
    permissions: [],
  },
} satisfies AuthCapabilities;
