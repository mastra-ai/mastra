/**
 * RBAC Permission Enforcement Tests
 *
 * Tests that the server properly enforces RBAC permissions on API endpoints.
 */

import type { ServerRoute } from '@mastra/server/server-adapter';
import { createDefaultTestContext } from '@mastra/server-adapters-test-suite';
import type { AdapterTestContext } from '@mastra/server-adapters-test-suite';
import { Elysia } from 'elysia';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MastraServer } from '../index';

// Simulate @mastra/core/auth/ee failing to provide the permission checker.
vi.mock('@mastra/core/auth/ee', async importOriginal => {
  const actual = await importOriginal<Record<string, unknown>>();
  const module = { ...actual };
  Object.defineProperty(module, 'hasPermission', {
    get() {
      throw new Error('simulated: @mastra/core/auth/ee could not be loaded');
    },
  });
  return module;
});

/**
 * Role permissions matching the PRD specification.
 */
const ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: ['*'],
  member: ['agents:read', 'workflows:*', 'tools:read', 'tools:execute'],
  viewer: ['agents:read', 'workflows:read'],
  readonly: ['*:read'],
  _default: [],
};

/**
 * Creates a test route with permission requirement.
 */
function createProtectedRoute(permission: string): ServerRoute<any, any, any> {
  return {
    method: 'GET',
    path: `/api/test/${permission.replace(':', '-')}`,
    responseType: 'json',
    requiresPermission: permission,
    handler: async () => ({ success: true, permission }),
  };
}

/**
 * Creates a mock auth config that uses Bearer token as role.
 */
function createMockAuthConfig() {
  return {
    authenticateToken: async (token: string) => {
      if (!token) return null;
      const role = token;
      const permissions = ROLE_PERMISSIONS[role];
      if (!permissions) return null;
      return {
        id: `user_${role}`,
        email: `${role}@test.com`,
        name: `Test ${role}`,
        role,
      };
    },
    authorize: async () => true,
  };
}

/**
 * Creates a mock RBAC provider that resolves permissions based on user role.
 */
function createMockRBACProvider() {
  return {
    getPermissions: async (user: { role: string }) => {
      return ROLE_PERMISSIONS[user.role] || [];
    },
    getRoles: async (user: { role: string }) => {
      return [user.role];
    },
  };
}

/**
 * Helper to set up an adapter with auth configured.
 */
async function setupAuthAdapter(context: AdapterTestContext) {
  const app = new Elysia();

  const originalGetServer = context.mastra.getServer.bind(context.mastra);
  context.mastra.getServer = () =>
    ({
      ...originalGetServer(),
      auth: createMockAuthConfig(),
      rbac: createMockRBACProvider(),
    }) as any;

  const adapter = new MastraServer({
    app,
    mastra: context.mastra,
  });

  adapter.registerContextMiddleware();
  adapter.registerAuthMiddleware();

  return { app, adapter };
}

describe('RBAC when the permission checker cannot load', () => {
  let context: AdapterTestContext;

  beforeEach(async () => {
    context = await createDefaultTestContext();
  });

  it('denies a protected route when RBAC is configured', async () => {
    const { app, adapter } = await setupAuthAdapter(context);
    await adapter.registerRoute(app, createProtectedRoute('agents:read'), { prefix: '' });
    const response = await app.fetch(
      new Request('http://localhost/api/test/agents-read', {
        method: 'GET',
        headers: { Authorization: 'Bearer admin' },
      }),
    );
    const status = response.status;
    const data = await response.json();
    expect(status).toBe(403);
    expect(data).toEqual({ error: 'Forbidden', message: 'Missing required permission: agents:read' });
  });

  it('leaves routes alone when RBAC is not configured', async () => {
    const { app, adapter } = await setupAuthAdapter(context);
    const withRbac = context.mastra.getServer;
    context.mastra.getServer = () => ({ ...withRbac(), rbac: undefined }) as any;
    await adapter.registerRoute(app, createProtectedRoute('agents:read'), { prefix: '' });
    const response = await app.fetch(
      new Request('http://localhost/api/test/agents-read', {
        method: 'GET',
        headers: { Authorization: 'Bearer admin' },
      }),
    );
    const status = response.status;
    const data = await response.json();
    expect(status).toBe(200);
    expect(data.success).toBe(true);
  });
});
