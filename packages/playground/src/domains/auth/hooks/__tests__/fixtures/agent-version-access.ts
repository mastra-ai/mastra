import type { AuthCapabilities } from '../../../types';

export const agentVersionAccessCapabilities = (permissions: string[]): AuthCapabilities => ({
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
    roles: ['operator'],
    permissions,
  },
});
