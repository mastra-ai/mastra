import type { AuthCapabilities, CurrentUser } from '@/domains/auth/types';

/** The signed-in user used by hooks that scope reads to the caller. */
export const currentUser = {
  id: 'user-1',
  email: 'user-1@example.com',
} satisfies CurrentUser;

/** Auth enabled → new entities default to `private` (owned by creator). */
export const authEnabledCapabilities = {
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
    roles: ['editor'],
    permissions: [],
  },
} satisfies AuthCapabilities;

/** Auth disabled → everything is `public` (no ownership concept). */
export const authDisabledCapabilities = {
  enabled: false,
  login: null,
} satisfies AuthCapabilities;

/**
 * Builds RBAC-enabled capabilities granting an explicit permission set, so
 * `usePermissions` resolves real `hasPermission`/`hasAnyPermission` checks.
 */
export const rbacCapabilities = (permissions: string[], roles: string[] = ['member']) =>
  ({
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
      roles,
      permissions,
    },
  }) satisfies AuthCapabilities;

/**
 * Auth enabled with full permissions → new entities default to `private` and
 * `hasPermission('workspaces:write')` is true (workspace writes run).
 */
export const authEnabledWritableCapabilities = {
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
    roles: ['admin'],
    permissions: ['*'],
  },
} satisfies AuthCapabilities;
