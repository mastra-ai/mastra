import type { AdapterTestContext } from '@internal/server-adapter-test-utils';
import { createDefaultTestContext } from '@internal/server-adapter-test-utils';
import type { ServerRoute } from '@mastra/server/server-adapter';
import { beforeEach, describe, expect, it } from 'vitest';
import { MastraServer } from '../index';

const ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: ['*'],
  member: ['agents:read', 'workflows:*', 'tools:read', 'tools:execute'],
  viewer: ['agents:read', 'workflows:read'],
  _default: [],
};

function createProtectedRoute(permission: string): ServerRoute<any, any, any> {
  return {
    method: 'GET',
    path: `/api/test/${permission.replace(':', '-')}`,
    responseType: 'json',
    requiresPermission: permission,
    handler: async () => ({ success: true, permission }),
  };
}

function createMockAuthConfig() {
  return {
    authenticateToken: async (token: string) => {
      if (!token) return null;
      const permissions = ROLE_PERMISSIONS[token];
      if (!permissions) return null;
      return { id: `user_${token}`, role: token };
    },
    authorize: async () => true,
  };
}

function createMockRBACProvider() {
  return {
    getPermissions: async (user: { role: string }) => ROLE_PERMISSIONS[user.role] || [],
    getRoles: async (user: { role: string }) => [user.role],
  };
}

async function setupAuthAdapter(context: AdapterTestContext) {
  const originalGetServer = context.mastra.getServer.bind(context.mastra);
  context.mastra.getServer = () => ({
    ...originalGetServer(),
    auth: createMockAuthConfig(),
    rbac: createMockRBACProvider(),
  });

  const adapter = new MastraServer({ mastra: context.mastra });
  adapter.registerContextMiddleware();
  adapter.registerAuthMiddleware();
  return adapter;
}

describe('RBAC Permission Enforcement', () => {
  let context: AdapterTestContext;

  beforeEach(async () => {
    context = await createDefaultTestContext();
  });

  it('returns 401 for unauthenticated request', async () => {
    const adapter = await setupAuthAdapter(context);
    await adapter.registerRoute(adapter.app, createProtectedRoute('agents:read'), { prefix: '' });
    const response = await adapter.app.request('http://localhost/api/test/agents-read');
    expect(response.status).toBe(401);
  });

  it('allows admin via wildcard permission', async () => {
    const adapter = await setupAuthAdapter(context);
    await adapter.registerRoute(adapter.app, createProtectedRoute('agents:execute'), { prefix: '' });
    const response = await adapter.app.request('http://localhost/api/test/agents-execute', {
      headers: { Authorization: 'Bearer admin' },
    });
    expect(response.status).toBe(200);
  });

  it('denies viewer for execute permission', async () => {
    const adapter = await setupAuthAdapter(context);
    await adapter.registerRoute(adapter.app, createProtectedRoute('agents:execute'), { prefix: '' });
    const response = await adapter.app.request('http://localhost/api/test/agents-execute', {
      headers: { Authorization: 'Bearer viewer' },
    });
    expect(response.status).toBe(403);
  });
});
