import type { AuthCapabilities } from '@mastra/react/hooks/auth';

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
