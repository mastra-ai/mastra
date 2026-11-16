import { Mastra } from '@mastra/core';
import { Knowledge } from '@mastra/core/knowledge';
import { InMemoryStore } from '@mastra/core/storage';
import { KNOWLEDGE_ROUTES, MASTRA_KNOWLEDGE_PRINCIPALS_KEY } from '@mastra/server/server-adapter';
import { afterEach, describe, expect, it } from 'vitest';

/**
 * Configuration for the Knowledge routes test suite
 */
export interface KnowledgeRoutesTestSuiteConfig {
  /** Name for the test suite */
  suiteName?: string;

  /**
   * Build an app for the given Mastra instance, run the adapter's `init()`, and
   * return a way to send HTTP requests to it by path (e.g. `/api/knowledge`).
   */
  startServer: (mastra: Mastra) => Promise<{
    request: (path: string, init?: RequestInit) => Promise<Response>;
    close?: () => Promise<void>;
  }>;
}

/**
 * The opt-in Knowledge routes on every adapter: RBAC `knowledge:read` gates them, the Knowledge principals
 * `authorize` sets through `context.get('requestContext')` reach the handler (no mapping is refused), and a
 * repeated query param (`scopeId`) arrives as a list.
 */
export function createKnowledgeRoutesTestSuite(config: KnowledgeRoutesTestSuiteConfig) {
  const { suiteName = 'Knowledge routes', startServer } = config;

  describe(suiteName, () => {
    let close: (() => Promise<void>) | undefined;

    afterEach(async () => {
      await close?.();
      close = undefined;
    });

    const setup = async () => {
      const knowledge = new Knowledge({ id: 'kb', scopes: {}, storage: new InMemoryStore({ id: 'kb' }) });
      const store = await knowledge.getStorage();
      const provenance = { author: 'test' };
      const scopes: Record<string, string> = {};
      for (const [team, page] of [
        ['support', 'Payments runbook'],
        ['eng', 'Payments service'],
        ['sales', 'Payments pricing'],
      ] as const) {
        const { scope } = await store.materializeScope({
          address: `team:${team}`,
          declaration: 'team:$teamId',
          name: team,
          provenance,
        });
        scopes[team] = scope.id;
        await store.createPage({ parentId: scope.id, name: page, provenance });
      }

      // Token -> permissions. `authorize` maps `reader-token` to every page; `unmapped-token` holds the
      // permission but gets no Knowledge principals.
      const permissions: Record<string, string[]> = {
        'reader-token': ['knowledge:read'],
        'unmapped-token': ['knowledge:read'],
        'other-token': [],
      };
      const mastra = new Mastra({
        logger: false,
        knowledge: { main: knowledge },
        server: { apiRoutes: [...KNOWLEDGE_ROUTES] },
      });
      const originalGetServer = mastra.getServer.bind(mastra);
      mastra.getServer = () =>
        ({
          ...originalGetServer(),
          rbac: {
            getRoles: async () => ['member'],
            getPermissions: async (user: { id: string }) => permissions[user.id] ?? [],
          },
          auth: {
            authenticateToken: async (token: string) => (token in permissions ? { id: token } : null),
            authorize: async (_path: string, _method: string, user: { id: string }, context: any) => {
              if (user.id === 'reader-token') context.get('requestContext').set(MASTRA_KNOWLEDGE_PRINCIPALS_KEY, 'all');
              return true;
            },
          },
        }) as any;

      const server = await startServer(mastra);
      close = server.close;
      const get = (path: string, token?: string) =>
        server.request(`/api/knowledge/main${path}`, token ? { headers: { authorization: `Bearer ${token}` } } : {});
      return { get, scopes };
    };

    it('serves a reader authorize mapped to Knowledge principals and refuses everyone else', async () => {
      const { get } = await setup();

      const roots = await get('/tree', 'reader-token');
      expect(roots.status).toBe(200);
      const body = (await roots.json()) as { pages: Array<{ name: string }> };
      expect(body.pages.map(page => page.name).sort()).toEqual(['eng', 'sales', 'support']);

      expect((await get('/tree', 'unmapped-token')).status).toBe(403);
      expect((await get('/tree', 'other-token')).status).toBe(403);
      expect((await get('/tree')).status).toBe(401);
    });

    it('reads a repeated scopeId param as a list', async () => {
      const { get, scopes } = await setup();
      const res = await get(`/search?q=payments&scopeId=${scopes.support}&scopeId=${scopes.eng}`, 'reader-token');
      expect(res.status).toBe(200);
      const body = (await res.json()) as { results: Array<{ page: { name: string } }> };
      expect(body.results.map(hit => hit.page.name).sort()).toEqual(['Payments runbook', 'Payments service']);
    });
  });
}
