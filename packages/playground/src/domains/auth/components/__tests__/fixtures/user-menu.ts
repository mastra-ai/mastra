import type { AuthenticatedCapabilities } from '../../../types';

export const userMenuCapabilities: AuthenticatedCapabilities = {
  enabled: true,
  login: null,
  user: { id: 'user', name: 'Draft user' },
  capabilities: { user: true, session: true, sso: false, rbac: false, acl: false },
  access: null,
};
