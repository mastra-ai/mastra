import { MastraAuthWorkos, MastraRBACWorkos } from '@mastra/auth-workos';

import { requiredEnv } from './env';

export async function initWorkOS() {
  requiredEnv('WORKOS_API_KEY');
  requiredEnv('WORKOS_CLIENT_ID');
  requiredEnv('WORKOS_COOKIE_PASSWORD');

  const mastraAuth = new MastraAuthWorkos({
    redirectUri: process.env.WORKOS_REDIRECT_URI || 'http://localhost:4111/api/auth/callback',
    fetchMemberships: true,
  });

  const rbacProvider = new MastraRBACWorkos({
    cache: {
      ttlMs: 1,
    },
    roleMapping: {
      admin: ['*'],
      superadmin: ['*'],
      member: [
        'agent-builder:*',
        'stored-agents:*',
        'stored-skills:*',
        'stored-workspaces:*',
        'tools:read',
        'agents:read',
        'agents:execute',
        'workflows:read',
        'workflows:execute',
        'memory:*',
        'observability:read',
        'logs:read',
      ],
      operator: ['agents:read', 'agents:execute', 'tools:read', 'workflows:read', 'workflows:execute'],
      viewer: ['agent-builder:read', 'agents:read', 'tools:read', 'workflows:read', 'stored-agents:read', 'stored-skills:read'],
      auditor: ['observability:read', 'logs:read'],
      _default: [],
    },
  });

  return { mastraAuth, rbacProvider };
}
