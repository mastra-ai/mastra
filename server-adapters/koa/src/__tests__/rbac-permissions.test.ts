/**
 * RBAC Permission Enforcement Tests for Koa Adapter
 *
 * Tests that the server properly enforces RBAC permissions on API endpoints.
 * These tests verify:
 * - Routes with `requiresPermission` return 403 when user lacks permission
 * - Routes with `requiresPermission` return 200 when user has permission
 * - Unauthenticated requests return 401
 * - Wildcard (*) permissions grant access to all routes
 */

import type { Server } from 'node:http';
import { createDefaultTestContext, type AdapterTestContext } from '@internal/server-adapter-test-utils';
import type { ServerRoute } from '@mastra/server/server-adapter';
import Koa from 'koa';
import bodyParser from 'koa-bodyparser';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MastraServer } from '../index';

/**
 * Role permissions matching the PRD specification.
 */
const ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: ['*'],
  member: ['agents:read', 'workflows:*', 'tools:read', 'tools:execute'],
  viewer: ['agents:read', 'workflows:read'],
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
  const app = new Koa();
  app.use(bodyParser());

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

/**
 * Helper to make HTTP requests to the Koa server.
 */
async function makeRequest(
  server: Server,
  path: string,
  options: { method?: string; headers?: Record<string, string> } = {},
): Promise<{ status: number; data: any }> {
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Failed to get server address');
  }
  const port = address.port;
  const url = `http://localhost:${port}${path}`;

  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  let data: any;
  try {
    data = await response.json();
  } catch {
    data = {};
  }

  return { status: response.status, data };
}

describe('Koa RBAC Permission Enforcement', () => {
  let context: AdapterTestContext;
  let server: Server | null = null;

  beforeEach(async () => {
    context = await createDefaultTestContext();
  });

  afterEach(async () => {
    if (server) {
      await new Promise<void>(resolve => {
        server!.close(() => resolve());
      });
      server = null;
    }
  });

  async function startServer(app: Koa): Promise<Server> {
    return new Promise(resolve => {
      const s = app.listen(0, () => resolve(s));
    });
  }

  describe('Unauthenticated Access', () => {
    it('should return 401 for unauthenticated request to protected route', async () => {
      const { app, adapter } = await setupAuthAdapter(context);
      const testRoute = createProtectedRoute('agents:read');
      await adapter.registerRoute(app, testRoute, { prefix: '' });

      server = await startServer(app);

      // Make request without Authorization header
      const { status } = await makeRequest(server, '/api/test/agents-read');

      expect(status).toBe(401);
    });
  });

  describe('Admin Role Access', () => {
    it('should allow admin to access agents:read route', async () => {
      const { app, adapter } = await setupAuthAdapter(context);
      const testRoute = createProtectedRoute('agents:read');
      await adapter.registerRoute(app, testRoute, { prefix: '' });

      server = await startServer(app);

      const { status, data } = await makeRequest(server, '/api/test/agents-read', {
        headers: { Authorization: 'Bearer admin' },
      });

      expect(status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should allow admin to access agents:execute route (wildcard permission)', async () => {
      const { app, adapter } = await setupAuthAdapter(context);
      const testRoute = createProtectedRoute('agents:execute');
      await adapter.registerRoute(app, testRoute, { prefix: '' });

      server = await startServer(app);

      const { status } = await makeRequest(server, '/api/test/agents-execute', {
        headers: { Authorization: 'Bearer admin' },
      });

      expect(status).toBe(200);
    });
  });

  describe('Member Role Access', () => {
    it('should allow member to access agents:read route', async () => {
      const { app, adapter } = await setupAuthAdapter(context);
      const testRoute = createProtectedRoute('agents:read');
      await adapter.registerRoute(app, testRoute, { prefix: '' });

      server = await startServer(app);

      const { status } = await makeRequest(server, '/api/test/agents-read', {
        headers: { Authorization: 'Bearer member' },
      });

      expect(status).toBe(200);
    });

    it('should deny member access to agents:execute route', async () => {
      const { app, adapter } = await setupAuthAdapter(context);
      const testRoute = createProtectedRoute('agents:execute');
      await adapter.registerRoute(app, testRoute, { prefix: '' });

      server = await startServer(app);

      const { status, data } = await makeRequest(server, '/api/test/agents-execute', {
        headers: { Authorization: 'Bearer member' },
      });

      expect(status).toBe(403);
      expect(data.error).toBe('Forbidden');
    });

    it('should allow member to access workflows:execute route (wildcard workflows:*)', async () => {
      const { app, adapter } = await setupAuthAdapter(context);
      const testRoute = createProtectedRoute('workflows:execute');
      await adapter.registerRoute(app, testRoute, { prefix: '' });

      server = await startServer(app);

      const { status } = await makeRequest(server, '/api/test/workflows-execute', {
        headers: { Authorization: 'Bearer member' },
      });

      expect(status).toBe(200);
    });
  });

  describe('Viewer Role Access', () => {
    it('should allow viewer to access agents:read route', async () => {
      const { app, adapter } = await setupAuthAdapter(context);
      const testRoute = createProtectedRoute('agents:read');
      await adapter.registerRoute(app, testRoute, { prefix: '' });

      server = await startServer(app);

      const { status } = await makeRequest(server, '/api/test/agents-read', {
        headers: { Authorization: 'Bearer viewer' },
      });

      expect(status).toBe(200);
    });

    it('should deny viewer access to agents:execute route', async () => {
      const { app, adapter } = await setupAuthAdapter(context);
      const testRoute = createProtectedRoute('agents:execute');
      await adapter.registerRoute(app, testRoute, { prefix: '' });

      server = await startServer(app);

      const { status } = await makeRequest(server, '/api/test/agents-execute', {
        headers: { Authorization: 'Bearer viewer' },
      });

      expect(status).toBe(403);
    });

    it('should deny viewer access to workflows:execute route', async () => {
      const { app, adapter } = await setupAuthAdapter(context);
      const testRoute = createProtectedRoute('workflows:execute');
      await adapter.registerRoute(app, testRoute, { prefix: '' });

      server = await startServer(app);

      const { status } = await makeRequest(server, '/api/test/workflows-execute', {
        headers: { Authorization: 'Bearer viewer' },
      });

      expect(status).toBe(403);
    });

    it('should deny viewer access to tools:read route', async () => {
      const { app, adapter } = await setupAuthAdapter(context);
      const testRoute = createProtectedRoute('tools:read');
      await adapter.registerRoute(app, testRoute, { prefix: '' });

      server = await startServer(app);

      const { status } = await makeRequest(server, '/api/test/tools-read', {
        headers: { Authorization: 'Bearer viewer' },
      });

      expect(status).toBe(403);
    });
  });

  describe('Default Role Access (No Permissions)', () => {
    it('should deny _default role access to agents:read route', async () => {
      const { app, adapter } = await setupAuthAdapter(context);
      const testRoute = createProtectedRoute('agents:read');
      await adapter.registerRoute(app, testRoute, { prefix: '' });

      server = await startServer(app);

      const { status } = await makeRequest(server, '/api/test/agents-read', {
        headers: { Authorization: 'Bearer _default' },
      });

      expect(status).toBe(403);
    });
  });

  describe('Invalid Token Handling', () => {
    it('should return 401 for invalid/unknown role token', async () => {
      const { app, adapter } = await setupAuthAdapter(context);
      const testRoute = createProtectedRoute('agents:read');
      await adapter.registerRoute(app, testRoute, { prefix: '' });

      server = await startServer(app);

      const { status } = await makeRequest(server, '/api/test/agents-read', {
        headers: { Authorization: 'Bearer invalidrole' },
      });

      expect(status).toBe(401);
    });
  });

  describe('Error Response Security', () => {
    it('should not leak sensitive information in 403 response', async () => {
      const { app, adapter } = await setupAuthAdapter(context);
      const testRoute = createProtectedRoute('agents:execute');
      await adapter.registerRoute(app, testRoute, { prefix: '' });

      server = await startServer(app);

      const { status, data } = await makeRequest(server, '/api/test/agents-execute', {
        headers: { Authorization: 'Bearer viewer' },
      });

      expect(status).toBe(403);
      const bodyStr = JSON.stringify(data);

      // Should not contain sensitive info
      expect(bodyStr).not.toContain('apiKey');
      expect(bodyStr).not.toContain('secret');
      expect(bodyStr).not.toContain('password');
      expect(bodyStr).not.toContain('stack');
    });
  });

  describe('Routes Without Permission Requirements', () => {
    it('should allow access to routes without requiresPermission when authenticated', async () => {
      const { app, adapter } = await setupAuthAdapter(context);

      // Route without requiresPermission
      const publicRoute: ServerRoute<any, any, any> = {
        method: 'GET',
        path: '/api/public',
        responseType: 'json',
        handler: async () => ({ public: true }),
      };

      await adapter.registerRoute(app, publicRoute, { prefix: '' });

      server = await startServer(app);

      // Authenticated user should access even without specific permission
      const { status } = await makeRequest(server, '/api/public', {
        headers: { Authorization: 'Bearer viewer' },
      });

      expect(status).toBe(200);
    });
  });
});
