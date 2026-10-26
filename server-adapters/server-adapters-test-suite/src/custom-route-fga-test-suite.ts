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
  });
}
