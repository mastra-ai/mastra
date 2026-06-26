import type { AuthCapabilities } from '@/domains/auth/types';

export const readOnlyAuthCapabilities = {
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
