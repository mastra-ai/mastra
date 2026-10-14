/**
 * RBAC Permission Enforcement Tests
 *
 * Tests that the server properly enforces RBAC permissions on API endpoints.
 * These tests verify:
 * - Routes with `requiresPermission` return 403 when user lacks permission
 * - Routes with `requiresPermission` return 200 when user has permission
 * - Unauthenticated requests return 401
 * - Wildcard (*) permissions grant access to all routes
 */

import type { ServerRoute } from '@mastra/server/server-adapter';
import { createDefaultTestContext } from '@mastra/server-adapters-test-suite';
import type { AdapterTestContext } from '@mastra/server-adapters-test-suite';
import { Hono } from 'hono';
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
  readonly: ['*:read'], // Action wildcard: read access to all resources
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
 * The authorize function always returns true for authenticated users,
 * letting the route-level requiresPermission handle fine-grained permissions.
 */
function createMockAuthConfig() {
  return {
    authenticateToken: async (token: string) => {
      if (!token) return null;

      // Use token value as role name
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
    // Allow all authenticated users through authorization middleware
    // Route-level requiresPermission will handle fine-grained access control
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
  const app = new Hono();

  // Mock server config with auth and RBAC
  const originalGetServer = context.mastra.getServer.bind(context.mastra);
  context.mastra.getServer = () => ({
    ...originalGetServer(),
    auth: createMockAuthConfig(),
    rbac: createMockRBACProvider(),
  });

  const adapter = new MastraServer({
    app,
    mastra: context.mastra,
  });

  // Register context middleware (sets up requestContext)
  adapter.registerContextMiddleware();

  // Register auth middleware (validates tokens and sets userPermissions)
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
    const response = await app.request(
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
    const response = await app.request(
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
