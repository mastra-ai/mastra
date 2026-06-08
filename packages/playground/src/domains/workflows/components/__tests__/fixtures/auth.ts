import type { AuthCapabilities } from '@/domains/auth/types';

export const fullAccessAuthCapabilities = {
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
