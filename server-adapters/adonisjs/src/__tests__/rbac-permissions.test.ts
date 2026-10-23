/**
 * RBAC enforcement through the AdonisJS adapter, for built-in style routes and
 * custom API routes (registerApiRoute) with `requiresPermission`.
 */
import { registerApiRoute } from '@mastra/core/server';
import type { ServerRoute } from '@mastra/server/server-adapter';
import { createDefaultTestContext } from '@mastra/server-adapters-test-suite';
import type { AdapterTestContext } from '@mastra/server-adapters-test-suite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MastraServer } from '../index';
import { createAdonisRouter, listen } from './helpers';

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

function withAuth(context: AdapterTestContext, apiRoutes?: unknown[]) {
  const originalGetServer = context.mastra.getServer.bind(context.mastra);
  context.mastra.getServer = () =>
    ({
      ...originalGetServer(),
      ...(apiRoutes ? { apiRoutes } : {}),
      auth: {
        authenticateToken: async (token: string) =>
          token && ROLE_PERMISSIONS[token] ? { id: `user_${token}`, role: token } : null,
        authorize: async () => true,
      },
      rbac: {
        getPermissions: async (user: { role: string }) => ROLE_PERMISSIONS[user.role] || [],
        getRoles: async (user: { role: string }) => [user.role],
      },
    }) as any;
}

describe('AdonisJS RBAC Permission Enforcement', () => {
  let context: AdapterTestContext;
  let close: (() => Promise<void>) | undefined;

  beforeEach(async () => {
    context = await createDefaultTestContext();
  });

  afterEach(async () => {
    await close?.();
    close = undefined;
  });

  async function request(permission: string, role?: string) {
    withAuth(context);
    const router = await createAdonisRouter();
    const adapter = new MastraServer({ app: router, mastra: context.mastra });
    await adapter.registerRoute(router, createProtectedRoute(permission), { prefix: '' });
    const server = await listen(router);
    close = server.close;
    const res = await fetch(`${server.url}/api/test/${permission.replace(':', '-')}`, {
      headers: role ? { Authorization: `Bearer ${role}` } : {},
    });
    return { status: res.status, data: (await res.json()) as any };
  }

  it('returns 401 for an unauthenticated request', async () => {
    expect((await request('agents:read')).status).toBe(401);
  });

  it.each([
    ['admin', 'agents:read', 200],
    ['admin', 'agents:execute', 200],
    ['member', 'agents:read', 200],
    ['member', 'agents:execute', 403],
    ['member', 'workflows:execute', 200],
    ['viewer', 'agents:read', 200],
    ['viewer', 'agents:execute', 403],
    ['viewer', 'workflows:execute', 403],
    ['_default', 'agents:read', 403],
  ])('%s requesting %s returns %i', async (role, permission, expected) => {
    const { status, data } = await request(permission, role);
    expect(status).toBe(expected);
    if (expected === 403) expect(data.error).toBe('Forbidden');
    else expect(data.success).toBe(true);
  });

  describe('custom API routes', () => {
    async function requestCustom(role?: string) {
      withAuth(context, [
        registerApiRoute('/reports', {
          method: 'GET',
          requiresPermission: 'reports:read',
          handler: async c => c.json({ ok: true }),
        }),
      ]);
      ROLE_PERMISSIONS.reporter = ['reports:read'];
      const router = await createAdonisRouter();
      await new MastraServer({ app: router, mastra: context.mastra }).init();
      const server = await listen(router);
      close = server.close;
      const res = await fetch(`${server.url}/reports`, {
        headers: role ? { Authorization: `Bearer ${role}` } : {},
      });
      return res.status;
    }

    it('requires authentication', async () => {
      expect(await requestCustom()).toBe(401);
    });

    it('denies a user without the permission', async () => {
      expect(await requestCustom('viewer')).toBe(403);
    });

    it('allows a user with the permission', async () => {
      expect(await requestCustom('reporter')).toBe(200);
    });
  });
});
