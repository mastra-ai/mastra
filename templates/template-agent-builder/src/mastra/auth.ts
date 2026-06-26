import { MastraAuthWorkos, MastraRBACWorkos } from '@mastra/auth-workos';

import { hasEnv } from './env';

export async function initWorkOS() {
  if (!hasEnv('WORKOS_API_KEY') || !hasEnv('WORKOS_CLIENT_ID') || !hasEnv('WORKOS_COOKIE_PASSWORD')) {
    return null;
  }

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
      viewer: [
        'agent-builder:read',
        'agents:read',
        'tools:read',
        'workflows:read',
        'stored-agents:read',
        'stored-skills:read',
      ],
      auditor: ['observability:read', 'logs:read'],
      _default: [],
    },
  });

  return { mastraAuth, rbacProvider };
}
