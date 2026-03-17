/**
 * Auth Middleware Execution Order Tests
 *
 * Verifies that requestContext.get('user') is populated before
 * server.middleware executes, so custom middleware can access the
 * authenticated user without decoding the token a second time.
 */
import { createDefaultTestContext } from '@internal/server-adapter-test-utils';
import type { AdapterTestContext } from '@internal/server-adapter-test-utils';
import { Hono } from 'hono';
import { describe, it, expect, beforeEach } from 'vitest';
import { MastraServer } from '../index';

function createMockAuthConfig() {
  return {
    authenticateToken: async (token: string) => {
      if (token === 'valid-token') {
        return { id: 'user-123', email: 'test@example.com' };
      }
      return null;
    },
    authorizeUser: async () => true,
  };
}

describe('Auth middleware execution order', () => {
  let context: AdapterTestContext;

  beforeEach(async () => {
    context = await createDefaultTestContext();
  });

  it('should populate requestContext with user before server.middleware executes', async () => {
    const app = new Hono();
    let userInMiddleware: unknown = undefined;

    const originalGetServer = context.mastra.getServer.bind(context.mastra);
    context.mastra.getServer = () => ({
      ...originalGetServer(),
      auth: createMockAuthConfig(),
    });

    const adapter = new MastraServer({ app, mastra: context.mastra });

    adapter.registerContextMiddleware();
    adapter.registerAuthMiddleware();

    // Simulate server.middleware registered after registerAuthMiddleware
    app.use('*', async (c, next) => {
      const requestContext = c.get('requestContext');
      userInMiddleware = requestContext?.get('user');
      return next();
    });

    const testRoute = {
      method: 'GET' as const,
      path: '/api/test',
      responseType: 'json' as const,
      handler: async () => ({ success: true }),
    };
    await adapter.registerRoute(app, testRoute, { prefix: '' });

    await app.request(
      new Request('http://localhost/api/test', {
        method: 'GET',
        headers: { Authorization: 'Bearer valid-token' },
      }),
    );

    expect(userInMiddleware).toBeDefined();
    expect((userInMiddleware as any).id).toBe('user-123');
  });

  it('should not block request when token is missing', async () => {
    const app = new Hono();

    const originalGetServer = context.mastra.getServer.bind(context.mastra);
    context.mastra.getServer = () => ({
      ...originalGetServer(),
      auth: createMockAuthConfig(),
    });

    const adapter = new MastraServer({ app, mastra: context.mastra });
    adapter.registerContextMiddleware();
    adapter.registerAuthMiddleware();

    const testRoute = {
      method: 'GET' as const,
      path: '/api/public',
      responseType: 'json' as const,
      requiresAuth: false,
      handler: async () => ({ success: true }),
    };
    await adapter.registerRoute(app, testRoute, { prefix: '' });

    const response = await app.request(new Request('http://localhost/api/public', { method: 'GET' }));

    expect(response.status).toBe(200);
  });

  it('should not populate user when token is invalid', async () => {
    const app = new Hono();
    let userInMiddleware: unknown = 'not-set';

    const originalGetServer = context.mastra.getServer.bind(context.mastra);
    context.mastra.getServer = () => ({
      ...originalGetServer(),
      auth: createMockAuthConfig(),
    });

    const adapter = new MastraServer({ app, mastra: context.mastra });
    adapter.registerContextMiddleware();
    adapter.registerAuthMiddleware();

    app.use('*', async (c, next) => {
      const requestContext = c.get('requestContext');
      userInMiddleware = requestContext?.get('user');
      return next();
    });

    const testRoute = {
      method: 'GET' as const,
      path: '/api/test',
      responseType: 'json' as const,
      requiresAuth: false,
      handler: async () => ({ success: true }),
    };
    await adapter.registerRoute(app, testRoute, { prefix: '' });

    await app.request(
      new Request('http://localhost/api/test', {
        method: 'GET',
        headers: { Authorization: 'Bearer invalid-token' },
      }),
    );

    expect(userInMiddleware).toBeUndefined();
  });
});
