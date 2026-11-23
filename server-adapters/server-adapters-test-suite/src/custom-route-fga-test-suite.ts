import { Mastra } from '@mastra/core';
import type { IFGAProvider } from '@mastra/core/auth/ee';
import { registerApiRoute } from '@mastra/core/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Configuration for the custom-route FGA test suite
 */
export interface CustomRouteFGATestSuiteConfig {
  /** Name for the test suite */
  suiteName?: string;

  /**
   * Build an app for the given Mastra instance, run the adapter's `init()`, and
   * return a way to send HTTP requests to it by path (e.g. `/docs/locked?x=1`).
   */
  startServer: (mastra: Mastra) => Promise<{
    request: (path: string, init?: RequestInit) => Promise<Response>;
    close?: () => Promise<void>;
  }>;
}

/**
 * Custom `registerApiRoute()` handlers read path params from the URL. FGA must
 * authorize that same resource, so a query or body field named like a path
 * param must not change which resource is checked.
 */
export function createCustomRouteFGATestSuite(config: CustomRouteFGATestSuiteConfig) {
  const { suiteName = 'Custom route FGA', startServer } = config;

  describe(suiteName, () => {
    let close: (() => Promise<void>) | undefined;

    afterEach(async () => {
      await close?.();
      close = undefined;
    });

    const setup = async () => {
      const check = vi.fn(async (_user: unknown, { resource }: { resource: { id: string } }) => resource.id === 'open');
      const fga: IFGAProvider = { check, require: vi.fn(), filterAccessible: vi.fn() };
      const routeFGA = { resourceType: 'doc', resourceIdParam: 'docId', permission: 'docs:read' };
      const handler = async (c: any) => c.json({ docId: c.req.param('docId') });
      const mastra = new Mastra({
        logger: false,
        server: {
          fga,
          apiRoutes: [
            registerApiRoute('/docs/:docId', { method: 'GET', fga: routeFGA, handler }),
            registerApiRoute('/docs/:docId', { method: 'POST', fga: routeFGA, handler }),
          ],
        },
      });
      const originalGetServer = mastra.getServer.bind(mastra);
      mastra.getServer = () =>
        ({
          ...originalGetServer(),
          auth: {
            authenticateToken: async (token: string) => (token === 'valid-token' ? { id: 'user-1' } : null),
            authorize: async () => true,
          },
        }) as any;

      const server = await startServer(mastra);
      close = server.close;
      const send = (path: string, init: RequestInit = {}) =>
        server.request(path, {
          ...init,
          headers: { authorization: 'Bearer valid-token', ...(init.headers as Record<string, string>) },
        });
      return { check, send };
    };

    const checkedIds = (check: ReturnType<typeof vi.fn>) =>
      check.mock.calls.map(([, input]) => (input as { resource: { id: string } }).resource.id);

    it('allows the permitted resource and denies the forbidden one', async () => {
      const { send } = await setup();
      const allowed = await send('/docs/open');
      expect(allowed.status).toBe(200);
      expect(await allowed.json()).toEqual({ docId: 'open' });
      expect((await send('/docs/locked')).status).toBe(403);
    });

    it('checks the path param when the query has a field with the same name', async () => {
      const { check, send } = await setup();
      const response = await send('/docs/locked?docId=open');
      expect(response.status).toBe(403);
      expect(checkedIds(check)).toEqual(['locked']);
    });

    it('checks the path param when the JSON body has a field with the same name', async () => {
      const { check, send } = await setup();
      const response = await send('/docs/locked', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ docId: 'open' }),
      });
      expect(response.status).toBe(403);
      expect(checkedIds(check)).toEqual(['locked']);
    });

    it('authenticates overlapping routes the same way they are dispatched', async () => {
      // A protected parameterized route registered before a public static one
      // matches the static path first, so its auth rules must apply there too.
      const mastra = new Mastra({
        logger: false,
        server: {
          apiRoutes: [
            registerApiRoute('/admin/:id', { method: 'GET', handler: async (c: any) => c.json({ route: 'admin' }) }),
            registerApiRoute('/admin/public', {
              method: 'GET',
              requiresAuth: false,
              handler: async (c: any) => c.json({ route: 'public' }),
            }),
          ],
        },
      });
      const originalGetServer = mastra.getServer.bind(mastra);
      mastra.getServer = () =>
        ({
          ...originalGetServer(),
          auth: {
            authenticateToken: async (token: string) => (token === 'valid-token' ? { id: 'user-1' } : null),
            authorize: async () => true,
          },
        }) as any;

      const server = await startServer(mastra);
      close = server.close;

      expect((await server.request('/admin/public')).status).toBe(401);
      const authed = await server.request('/admin/public', { headers: { authorization: 'Bearer valid-token' } });
      expect(authed.status).toBe(200);
      expect(await authed.json()).toEqual({ route: 'admin' });
    });

    const startWithAuth = async (apiRoutes: ReturnType<typeof registerApiRoute>[]) => {
      const mastra = new Mastra({ logger: false, server: { apiRoutes } });
      const originalGetServer = mastra.getServer.bind(mastra);
      mastra.getServer = () =>
        ({
          ...originalGetServer(),
          auth: {
            authenticateToken: async (token: string) => (token === 'valid-token' ? { id: 'user-1' } : null),
            authorize: async () => true,
          },
        }) as any;
      const server = await startServer(mastra);
      close = server.close;
      return server;
    };
    const authed = { headers: { authorization: 'Bearer valid-token' } };

    it('does not run a protected route shadowed by an earlier public one without auth', async () => {
      // Public '/admin/:id' is registered first, so it serves '/admin/public'. The
      // protected '/admin/public' handler must never run for an unauthenticated caller.
      const protectedHandler = vi.fn(async (c: any) => c.json({ route: 'protected' }));
      const server = await startWithAuth([
        registerApiRoute('/admin/:id', {
          method: 'GET',
          requiresAuth: false,
          handler: async (c: any) => c.json({ route: 'param' }),
        }),
        registerApiRoute('/admin/public', { method: 'GET', handler: protectedHandler }),
      ]);

      const response = await server.request('/admin/public');
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ route: 'param' });
      expect(protectedHandler).not.toHaveBeenCalled();
    });

    it('requires auth for HEAD requests to a protected GET route', async () => {
      const protectedHandler = vi.fn(async (c: any) => c.json({ secret: true }));
      const server = await startWithAuth([registerApiRoute('/secret', { method: 'GET', handler: protectedHandler })]);

      expect((await server.request('/secret', { method: 'HEAD' })).status).toBe(401);
      expect(protectedHandler).not.toHaveBeenCalled();
      expect((await server.request('/secret', { method: 'HEAD', ...authed })).status).toBe(200);
    });

    it('matches routes case-sensitively when deciding auth', async () => {
      const protectedHandler = vi.fn(async (c: any) => c.json({ route: 'protected' }));
      const server = await startWithAuth([
        registerApiRoute('/Admin', {
          method: 'GET',
          requiresAuth: false,
          handler: async (c: any) => c.json({ route: 'public' }),
        }),
        registerApiRoute('/admin', { method: 'GET', handler: protectedHandler }),
      ]);

      expect((await server.request('/admin')).status).toBe(401);
      expect(protectedHandler).not.toHaveBeenCalled();
      const publicResponse = await server.request('/Admin');
      expect(publicResponse.status).toBe(200);
      expect(await publicResponse.json()).toEqual({ route: 'public' });
    });

    it('checks auth for percent-encoded paths against the route they decode to', async () => {
      // '/%61dmin' is dispatched to '/admin' after decoding, not to the public '/:page'.
      const protectedHandler = vi.fn(async (c: any) => c.json({ route: 'admin' }));
      const server = await startWithAuth([
        registerApiRoute('/admin', { method: 'GET', handler: protectedHandler }),
        registerApiRoute('/:page', {
          method: 'GET',
          requiresAuth: false,
          handler: async (c: any) => c.json({ route: 'page' }),
        }),
      ]);

      const response = await server.request('/%61dmin');
      expect(protectedHandler).not.toHaveBeenCalled();
      expect(response.status).not.toBe(200);
      expect((await server.request('/about')).status).toBe(200);
    });

    it('checks FGA with the params of the route that handles an overlapping path', async () => {
      // '/docs/:docId' is registered first, so it serves '/docs/open' even though the
      // framework may pick the static route. FGA must still see docId from the URL.
      const check = vi.fn(async (_user: unknown, { resource }: { resource: { id: string } }) => resource.id === 'open');
      const fga: IFGAProvider = { check, require: vi.fn(), filterAccessible: vi.fn() };
      const mastra = new Mastra({
        logger: false,
        server: {
          fga,
          apiRoutes: [
            registerApiRoute('/docs/:docId', {
              method: 'GET',
              fga: { resourceType: 'doc', resourceIdParam: 'docId', permission: 'docs:read' },
              handler: async (c: any) => c.json({ docId: c.req.param('docId') }),
            }),
            registerApiRoute('/docs/open', { method: 'GET', handler: async (c: any) => c.json({ route: 'static' }) }),
          ],
        },
      });
      const originalGetServer = mastra.getServer.bind(mastra);
      mastra.getServer = () =>
        ({
          ...originalGetServer(),
          auth: {
            authenticateToken: async (token: string) => (token === 'valid-token' ? { id: 'user-1' } : null),
            authorize: async () => true,
          },
        }) as any;

      const server = await startServer(mastra);
      close = server.close;

      const response = await server.request('/docs/open', { headers: { authorization: 'Bearer valid-token' } });
      expect(response.status).toBe(200);
      expect(checkedIds(check)).toEqual(['open']);
    });
  });
}
