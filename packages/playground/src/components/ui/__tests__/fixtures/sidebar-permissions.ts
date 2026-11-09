import type { AuthenticatedCapabilities } from '@mastra/react/hooks/auth';

export const adminSidebarCapabilities: AuthenticatedCapabilities = {
  enabled: true,
  login: { type: 'credentials' },
  user: { id: 'admin', name: 'Admin User', email: 'admin@example.com' },
  capabilities: { user: true, session: true, sso: false, rbac: true, acl: false },
  access: { roles: ['admin'], permissions: ['*'] },
};

export const memberSidebarCapabilities: AuthenticatedCapabilities = {
  ...adminSidebarCapabilities,
  user: { id: 'member', name: 'Member User', email: 'member@example.com' },
  access: { roles: ['member'], permissions: ['agents:read', 'workflows:*', 'tools:read', 'tools:execute'] },
};

export const viewerSidebarCapabilities: AuthenticatedCapabilities = {
  ...adminSidebarCapabilities,
  user: { id: 'viewer', name: 'Viewer User', email: 'viewer@example.com' },
  access: { roles: ['viewer'], permissions: ['agents:read', 'workflows:read'] },
};

export const rbacDisabledSidebarCapabilities: AuthenticatedCapabilities = {
  ...viewerSidebarCapabilities,
  capabilities: { ...viewerSidebarCapabilities.capabilities, rbac: false },
  access: null,
};
