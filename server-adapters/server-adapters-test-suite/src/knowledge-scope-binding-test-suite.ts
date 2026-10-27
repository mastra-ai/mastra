import { Mastra } from '@mastra/core';
import { Knowledge } from '@mastra/core/knowledge';
import { InMemoryStore } from '@mastra/core/storage';
import { KNOWLEDGE_ROUTES, MASTRA_KNOWLEDGE_SCOPE_KEY } from '@mastra/server/server-adapter';
import { afterEach, describe, expect, it } from 'vitest';

/**
 * Configuration for the Knowledge scope-binding test suite
 */
export interface KnowledgeScopeBindingTestSuiteConfig {
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

const ORG = 'org:acme';
const PROJECT_A = 'project:a';
const PROJECT_B = 'project:b';

/**
 * The documented binding: `authorize` reads the request context from its framework context with
 * `context.get('requestContext')` and sets the caller's Knowledge scope. It must work on every adapter, and
 * with RBAC configured an unbound caller must be refused rather than trusted.
 */
export function createKnowledgeScopeBindingTestSuite(config: KnowledgeScopeBindingTestSuiteConfig) {
  const { suiteName = 'Knowledge scope binding', startServer } = config;

  describe(suiteName, () => {
    let close: (() => Promise<void>) | undefined;

    afterEach(async () => {
      await close?.();
      close = undefined;
    });

    const setup = async () => {
      const knowledge = new Knowledge({ id: 'kb', storage: new InMemoryStore({ id: 'kb' }) });
      const store = await knowledge.getStorage();
      for (const [name, project] of [
        ['Payments', PROJECT_A],
        ['Billing', PROJECT_B],
      ] as const) {
        const scope = [ORG, project];
        const node = await store.createNode({ name, kind: 'service', scope });
        await store.appendKnowledge({
          node: node.id,
          text: `${name} is documented.`,
          scope,
          sourceThreadId: `t-${name}`,
          resolutionScope: scope,
          defaultScope: scope,
        });
      }

      // Token -> the tags the app binds for that caller; `unbound` sets nothing.
      const scopes: Record<string, string[] | undefined> = { 'a-token': [ORG, PROJECT_A], 'unbound-token': undefined };
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
            getRoles: async () => ['reader'],
            getPermissions: async () => ['knowledge:read'],
          },
          auth: {
            authenticateToken: async (token: string) => (token in scopes ? { id: token } : null),
            authorize: async (_path: string, _method: string, user: { id: string }, context: any) => {
              const scope = scopes[user.id];
              if (scope) context.get('requestContext').set(MASTRA_KNOWLEDGE_SCOPE_KEY, scope);
              return true;
            },
          },
        }) as any;

      const server = await startServer(mastra);
      close = server.close;
      const graph = (token: string, project: string) =>
        server.request(`/api/knowledge/main/graph?scope=${ORG}&scope=${project}`, {
          headers: { authorization: `Bearer ${token}` },
        });
      return { graph };
    };

    it('reads the bound scope and refuses a scope outside it', async () => {
      const { graph } = await setup();

      const own = await graph('a-token', PROJECT_A);
      expect(own.status).toBe(200);
      const body = (await own.json()) as { nodes: Array<{ name: string }> };
      expect(body.nodes.map(node => node.name)).toEqual(['Payments']);

      const other = await graph('a-token', PROJECT_B);
      expect(other.status).toBe(403);
    });

    it('refuses an authenticated caller with no bound scope when RBAC is configured', async () => {
      const { graph } = await setup();
      const res = await graph('unbound-token', PROJECT_B);
      expect(res.status).toBe(403);
    });
  });
}
