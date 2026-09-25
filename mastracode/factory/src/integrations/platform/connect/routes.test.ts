import { LibSQLFactoryStorage } from '@mastra/libsql';
import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';

import { fakeRouteAuth, mountApiRoutes } from '../../../routes/test-utils.js';
import type { TestAuthUser } from '../../../routes/test-utils.js';
import { KnowledgeImporterRoutingStorage } from '../../../storage/domains/importer-routing/base.js';
import { FactoryProjectsStorage } from '../../../storage/domains/projects/base.js';
import { PlatformApiClient } from '../api-client.js';
import { buildPlatformConnectRoutes, PLATFORM_CONNECT_PROVIDERS } from './routes.js';

const SESSION = {
  connectionId: 'conn-new',
  integrationId: 'jira',
  connectUrl: 'https://connect.nango.dev/session',
  sessionToken: 'nango-session-token',
  expiresAt: '2026-09-17T12:30:00.000Z',
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
}

function connection(id: string, integrationId: string, status: 'active' | 'needs_reauth' = 'active') {
  return { id, integrationId, status, accountLabel: `${integrationId}-account`, displayName: null };
}

function buildApp(
  user: TestAuthUser | null,
  fetchImpl: typeof fetch,
  options: {
    authEnabled?: boolean;
    routing?: KnowledgeImporterRoutingStorage;
    projects?: FactoryProjectsStorage;
    platformProjectId?: string;
  } = {},
): Hono {
  const app = new Hono();
  app.use('*', async (c, next) => {
    if (user) c.set('factoryAuthUser' as never, user as never);
    await next();
  });
  mountApiRoutes(
    app,
    buildPlatformConnectRoutes({
      auth: fakeRouteAuth({ enabled: options.authEnabled ?? true }),
      client: new PlatformApiClient({
        baseUrl: 'https://integrations.example.com',
        accessToken: 'platform-secret',
        fetchImpl,
      }),
      routing: options.routing,
      projects: options.projects,
      platformProjectId: options.platformProjectId,
    }),
  );
  return app;
}

/** Real in-memory storage with the routing + projects domains registered. */
function routingFixtures() {
  const storage = new LibSQLFactoryStorage({ url: ':memory:', id: 'routing-routes-test' });
  const routing = storage.registerDomain(new KnowledgeImporterRoutingStorage());
  const projects = storage.registerDomain(new FactoryProjectsStorage());
  return { storage, routing, projects };
}

const org1 = (): TestAuthUser => ({ workosId: 'u1', organizationId: 'org1' });

describe('PLATFORM_CONNECT_PROVIDERS registry', () => {
  it.each([
    ['jira', 'jira'],
    ['incident-io', 'incident-io'],
    ['notion', 'notion'],
    ['confluence', 'confluence'],
    ['linear', 'linear'],
    ['zendesk', 'zendesk'],
    ['fireflies', 'fireflies'],
  ])('registers %s → integrationId %s with matching connectionIntegrationIds', (slug, integrationId) => {
    const entry = PLATFORM_CONNECT_PROVIDERS[slug];
    expect(entry).toBeDefined();
    expect(entry.integrationId).toBe(integrationId);
    expect(entry.connectionIntegrationIds).toContain(integrationId);
  });
});

describe('platform connect routes', () => {
  it('lists Jira connections and hides other providers', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async () =>
      json({
        connections: [connection('conn-a', 'github'), connection('conn-b', 'jira', 'needs_reauth')],
      }),
    );
    const app = buildApp(org1(), fetchImpl);

    const response = await app.request('/web/integrations/platform/jira/connections');
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      connections: [expect.objectContaining({ id: 'conn-b' })],
    });
  });

  it('mints a connect session with the provider integration id', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async () => json(SESSION, 201));
    const app = buildApp(org1(), fetchImpl);

    const response = await app.request('/web/integrations/platform/incident-io/connect-session', { method: 'POST' });
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual(SESSION);
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://integrations.example.com/v2/integrations/incident-io/connect-sessions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ authorization: 'Bearer platform-secret' }),
      }),
    );
  });

  describe('platform project attachment', () => {
    it('mints project-scoped connect sessions when the deployment knows its Platform project', async () => {
      const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async () => json(SESSION, 201));
      const app = buildApp(org1(), fetchImpl, { platformProjectId: 'proj-42' });

      const response = await app.request('/web/integrations/platform/notion/connect-session', { method: 'POST' });
      expect(response.status).toBe(201);
      // Project-scoped mint → the Platform attaches the connection to the
      // project, which is what the knowledge importers resolver enumerates.
      expect(fetchImpl).toHaveBeenCalledWith(
        'https://integrations.example.com/v2/projects/proj-42/integrations/notion/connect-sessions',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('self-heals unattached active connections when listing, exactly once per process', async () => {
      const attachCalls: string[] = [];
      const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async (input, init) => {
        const url = String(input);
        if (url.endsWith('/v2/connections')) {
          return json({
            connections: [connection('conn-n1', 'notion'), connection('conn-n2', 'notion', 'needs_reauth')],
          });
        }
        if (init?.method === 'POST' && url.includes('/v2/projects/proj-42/connections/')) {
          attachCalls.push(url);
          return new Response(null, { status: 204 });
        }
        throw new Error(`Unexpected fetch: ${url}`);
      });
      const app = buildApp(org1(), fetchImpl, { platformProjectId: 'proj-42' });

      const first = await app.request('/web/integrations/platform/notion/connections');
      expect(first.status).toBe(200);
      // Only the active connection is attached — needs_reauth ones are left
      // for the reconnect flow (the Platform rejects establishing links for
      // connections it may be about to recycle).
      expect(attachCalls).toEqual(['https://integrations.example.com/v2/projects/proj-42/connections/conn-n1']);

      // Second list: the in-process dedupe suppresses a repeat POST.
      const second = await app.request('/web/integrations/platform/notion/connections');
      expect(second.status).toBe(200);
      expect(attachCalls).toHaveLength(1);
    });

    it('still answers the connections list when the attach self-heal fails', async () => {
      const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async (input, init) => {
        const url = String(input);
        if (url.endsWith('/v2/connections')) return json({ connections: [connection('conn-n1', 'notion')] });
        if (init?.method === 'POST') return json({ error: 'project_not_found' }, 404);
        throw new Error(`Unexpected fetch: ${url}`);
      });
      const app = buildApp(org1(), fetchImpl, { platformProjectId: 'proj-missing' });

      const response = await app.request('/web/integrations/platform/notion/connections');
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        connections: [expect.objectContaining({ id: 'conn-n1' })],
      });
    });

    it('keeps org-level minting and skips attachment when no project id is configured', async () => {
      const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async input => {
        const url = String(input);
        if (url.endsWith('/v2/connections')) return json({ connections: [connection('conn-n1', 'notion')] });
        if (url.endsWith('/v2/integrations/notion/connect-sessions')) return json(SESSION, 201);
        throw new Error(`Unexpected fetch: ${url}`);
      });
      const app = buildApp(org1(), fetchImpl);

      await app.request('/web/integrations/platform/notion/connections');
      const mint = await app.request('/web/integrations/platform/notion/connect-session', { method: 'POST' });
      expect(mint.status).toBe(201);
      // No project-scoped URLs anywhere in the call log.
      for (const call of fetchImpl.mock.calls) {
        expect(String(call[0])).not.toContain('/v2/projects/');
      }
    });
  });

  it('mints a reconnect session only for a connection owned by the provider', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async input => {
      const url = String(input);
      if (url.endsWith('/v2/connections')) {
        return json({ connections: [connection('conn-jira', 'jira', 'needs_reauth')] });
      }
      if (url.endsWith('/v2/connections/conn-jira/reconnect-session')) return json(SESSION, 201);
      throw new Error(`Unexpected fetch: ${url}`);
    });
    const app = buildApp(org1(), fetchImpl);

    const response = await app.request('/web/integrations/platform/jira/connections/conn-jira/reconnect-session', {
      method: 'POST',
    });
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual(SESSION);

    // A registered provider that does not own the connection: the ownership
    // filter itself must reject, not the unknown-provider gate.
    const crossProvider = await app.request(
      '/web/integrations/platform/incident-io/connections/conn-jira/reconnect-session',
      { method: 'POST' },
    );
    expect(crossProvider.status).toBe(404);
    await expect(crossProvider.json()).resolves.toEqual({ error: 'connection_not_found' });
  });

  describe('per-connection routing', () => {
    const listWithNotion = async () => json({ connections: [connection('conn-notion', 'notion')] });

    it('defaults to mode all when no routing was ever saved', async () => {
      const { routing } = routingFixtures();
      const fetchImpl = vi.fn<typeof fetch>().mockImplementation(listWithNotion);
      const app = buildApp(org1(), fetchImpl, { routing });

      const response = await app.request('/web/integrations/platform/notion/connections/conn-notion/routing');
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ routing: { mode: 'all', projectIds: [] } });
    });

    it('answers 404 on GET for a nonexistent or unowned connection instead of leaking a default', async () => {
      const { routing } = routingFixtures();
      const fetchImpl = vi.fn<typeof fetch>().mockImplementation(listWithNotion);
      const app = buildApp(org1(), fetchImpl, { routing });

      // Nonexistent connection: not in the platform's connection list.
      const ghost = await app.request('/web/integrations/platform/notion/connections/conn-ghost/routing');
      expect(ghost.status).toBe(404);
      // Cross-provider read: linear's page must not see notion's routing.
      const cross = await app.request('/web/integrations/platform/linear/connections/conn-notion/routing');
      expect(cross.status).toBe(404);
      await expect(cross.json()).resolves.toEqual({ error: 'connection_not_found' });
    });

    it('accepts a selected mode with an empty project selection — connected but linked nowhere', async () => {
      const { routing } = routingFixtures();
      const fetchImpl = vi.fn<typeof fetch>().mockImplementation(listWithNotion);
      const app = buildApp(org1(), fetchImpl, { routing });

      // A Platform connection with no Factory destinations is a valid state:
      // the OAuth grant stays established, imports just land nowhere until
      // the user links a project.
      const response = await app.request('/web/integrations/platform/notion/connections/conn-notion/routing', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mode: 'selected', projectIds: [] }),
      });
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ routing: { mode: 'selected', projectIds: [] } });

      const get = await app.request('/web/integrations/platform/notion/connections/conn-notion/routing');
      await expect(get.json()).resolves.toEqual({ routing: { mode: 'selected', projectIds: [] } });
    });

    it('round-trips a selected-projects routing through PUT and GET', async () => {
      const { routing, projects } = routingFixtures();
      await projects.ensureReady();
      const project = await projects.create({ orgId: 'org1', userId: 'u1', input: { name: 'Alpha' } });
      const fetchImpl = vi.fn<typeof fetch>().mockImplementation(listWithNotion);
      const app = buildApp(org1(), fetchImpl, { routing, projects });

      const put = await app.request('/web/integrations/platform/notion/connections/conn-notion/routing', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mode: 'selected', projectIds: [project.id] }),
      });
      expect(put.status).toBe(200);
      await expect(put.json()).resolves.toEqual({ routing: { mode: 'selected', projectIds: [project.id] } });

      const get = await app.request('/web/integrations/platform/notion/connections/conn-notion/routing');
      await expect(get.json()).resolves.toEqual({ routing: { mode: 'selected', projectIds: [project.id] } });

      // Switching back to all clears the selection.
      const reset = await app.request('/web/integrations/platform/notion/connections/conn-notion/routing', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mode: 'all' }),
      });
      await expect(reset.json()).resolves.toEqual({ routing: { mode: 'all', projectIds: [] } });
    });

    it('rejects invalid modes, malformed project ids, and unknown projects', async () => {
      const { routing, projects } = routingFixtures();
      const fetchImpl = vi.fn<typeof fetch>().mockImplementation(listWithNotion);
      const app = buildApp(org1(), fetchImpl, { routing, projects });
      const putRouting = (body: unknown) =>
        app.request('/web/integrations/platform/notion/connections/conn-notion/routing', {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        });

      expect((await putRouting({ mode: 'some' })).status).toBe(400);
      expect((await putRouting({ mode: 'selected', projectIds: 'p1' })).status).toBe(400);
      expect((await putRouting({ mode: 'selected', projectIds: [''] })).status).toBe(400);
      const unknown = await putRouting({ mode: 'selected', projectIds: ['ghost'] });
      expect(unknown.status).toBe(400);
      await expect(unknown.json()).resolves.toMatchObject({ error: 'unknown_project' });
    });

    it('refuses to save routing for a connection another provider owns', async () => {
      const { routing } = routingFixtures();
      const fetchImpl = vi.fn<typeof fetch>().mockImplementation(listWithNotion);
      const app = buildApp(org1(), fetchImpl, { routing });

      const response = await app.request('/web/integrations/platform/linear/connections/conn-notion/routing', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mode: 'all' }),
      });
      expect(response.status).toBe(404);
      await expect(response.json()).resolves.toEqual({ error: 'connection_not_found' });
    });

    it('mounts no routing routes when the storage domain is absent', async () => {
      const app = buildApp(org1(), vi.fn<typeof fetch>());
      const response = await app.request('/web/integrations/platform/notion/connections/conn-notion/routing');
      expect(response.status).toBe(404);
    });
  });

  it('rejects unknown providers, signed-out callers, and personal accounts', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const app = buildApp(org1(), fetchImpl);
    expect(
      (await app.request('/web/integrations/platform/unknown-provider/connect-session', { method: 'POST' })).status,
    ).toBe(404);

    const signedOut = buildApp(null, fetchImpl);
    expect(
      (await signedOut.request('/web/integrations/platform/jira/connect-session', { method: 'POST' })).status,
    ).toBe(401);

    const personal = buildApp({ workosId: 'u1' }, fetchImpl);
    expect((await personal.request('/web/integrations/platform/jira/connect-session', { method: 'POST' })).status).toBe(
      403,
    );

    const authDisabled = buildApp(org1(), fetchImpl, { authEnabled: false });
    expect(
      (await authDisabled.request('/web/integrations/platform/jira/connect-session', { method: 'POST' })).status,
    ).toBe(403);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  describe('/web/integrations/platform/catalog', () => {
    it('projects one row per registered provider and merges Platform catalog metadata', async () => {
      const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async () =>
        json({
          integrations: [
            {
              id: 'notion',
              provider: 'notion',
              displayName: 'Notion',
              logoUrl: 'https://app.nango.dev/images/template-logos/notion.svg',
            },
            {
              id: 'jira',
              provider: 'jira',
              displayName: 'Atlassian Jira',
              logoUrl: 'https://app.nango.dev/images/template-logos/jira.svg',
            },
            // Extra Platform entries the SPA doesn't need are ignored.
            { id: 'github', displayName: 'GitHub' },
          ],
        }),
      );
      const app = buildApp(org1(), fetchImpl);

      const response = await app.request('/web/integrations/platform/catalog');
      expect(response.status).toBe(200);
      const body = await response.json();
      const rows = body.integrations as Array<Record<string, unknown>>;
      // One row per registered SPA provider, including the ones the Platform
      // doesn't yet know about (fireflies, zendesk, etc. — logoUrl: null).
      expect(new Set(rows.map(r => r.provider))).toEqual(
        new Set(['jira', 'incident-io', 'notion', 'confluence', 'linear', 'zendesk', 'fireflies']),
      );
      expect(rows.find(r => r.provider === 'notion')).toMatchObject({
        integrationId: 'notion',
        displayName: 'Notion',
        logoUrl: 'https://app.nango.dev/images/template-logos/notion.svg',
      });
      expect(rows.find(r => r.provider === 'fireflies')).toMatchObject({
        integrationId: 'fireflies',
        displayName: null,
        logoUrl: null,
      });
    });

    it('caches the catalog for reuse within the TTL window', async () => {
      const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async () => json({ integrations: [] }));
      const app = buildApp(org1(), fetchImpl);
      await app.request('/web/integrations/platform/catalog');
      await app.request('/web/integrations/platform/catalog');
      // /v2/integrations should only be hit once thanks to the module-level cache.
      const catalogCalls = fetchImpl.mock.calls.filter(([input]) => String(input).endsWith('/v2/integrations'));
      expect(catalogCalls).toHaveLength(1);
    });

    it('rejects signed-out callers and personal accounts before touching Platform', async () => {
      const fetchImpl = vi.fn<typeof fetch>();
      const signedOut = buildApp(null, fetchImpl);
      expect((await signedOut.request('/web/integrations/platform/catalog')).status).toBe(401);

      const personal = buildApp({ workosId: 'u1' }, fetchImpl);
      expect((await personal.request('/web/integrations/platform/catalog')).status).toBe(403);
      expect(fetchImpl).not.toHaveBeenCalled();
    });

    it('serves the stale snapshot to every concurrent caller when a refresh fails', async () => {
      // First fetch succeeds → cache populated. Freeze time so the TTL doesn't
      // rescue us. Advance past the TTL, then fail every subsequent Platform
      // call: every concurrent caller must see the stale snapshot (not the
      // raw rejection) — the fix for the reviewer's "second caller bypasses
      // stale-fallback" defect.
      const fetchImpl = vi
        .fn<typeof fetch>()
        // First call: seed the cache.
        .mockResolvedValueOnce(json({ integrations: [{ id: 'notion', displayName: 'Notion', logoUrl: null }] }))
        // Subsequent calls: fail. Multiple concurrent callers should each
        // still receive the previously-cached snapshot, not the raw 500.
        .mockResolvedValue(json({ detail: 'boom' }, 500));
      const app = buildApp(org1(), fetchImpl);

      const seed = await app.request('/web/integrations/platform/catalog');
      expect(seed.status).toBe(200);
      const seeded = (await seed.json()).integrations as Array<Record<string, unknown>>;
      const seededNotion = seeded.find(r => r.provider === 'notion');
      expect(seededNotion?.displayName).toBe('Notion');

      // Fast-forward beyond TTL to force a refresh, then fire two concurrent
      // catalog requests. Both must resolve with the stale snapshot.
      vi.useFakeTimers();
      try {
        vi.setSystemTime(Date.now() + 6 * 60_000);
        const [a, b] = await Promise.all([
          app.request('/web/integrations/platform/catalog'),
          app.request('/web/integrations/platform/catalog'),
        ]);
        expect(a.status).toBe(200);
        expect(b.status).toBe(200);
        const rowsA = (await a.json()).integrations as Array<Record<string, unknown>>;
        const rowsB = (await b.json()).integrations as Array<Record<string, unknown>>;
        expect(rowsA.find(r => r.provider === 'notion')?.displayName).toBe('Notion');
        expect(rowsB.find(r => r.provider === 'notion')?.displayName).toBe('Notion');
      } finally {
        vi.useRealTimers();
      }
    });
  });

  it('maps platform conflicts and forbidden responses instead of returning 502', async () => {
    const conflictFetch = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => json({ detail: 'Reconnect session is already pending' }, 409));
    const conflictApp = buildApp(org1(), conflictFetch);
    const conflict = await conflictApp.request('/web/integrations/platform/jira/connect-session', { method: 'POST' });
    expect(conflict.status).toBe(409);
    await expect(conflict.json()).resolves.toEqual(expect.objectContaining({ error: 'session_pending' }));

    const forbiddenFetch = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => json({ detail: 'Your role has read-only access to this organization' }, 403));
    const forbiddenApp = buildApp(org1(), forbiddenFetch);
    const forbidden = await forbiddenApp.request('/web/integrations/platform/jira/connect-session', {
      method: 'POST',
    });
    expect(forbidden.status).toBe(403);
    await expect(forbidden.json()).resolves.toEqual(expect.objectContaining({ error: 'platform_forbidden' }));

    const failingFetch = vi.fn<typeof fetch>().mockImplementation(async () => json({ detail: 'boom' }, 500));
    const failingApp = buildApp(org1(), failingFetch);
    const failed = await failingApp.request('/web/integrations/platform/jira/connect-session', { method: 'POST' });
    expect(failed.status).toBe(502);
  });
});
