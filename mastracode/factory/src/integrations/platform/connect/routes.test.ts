import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';

import { fakeRouteAuth, mountApiRoutes } from '../../../routes/test-utils.js';
import type { TestAuthUser } from '../../../routes/test-utils.js';
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

function buildApp(user: TestAuthUser | null, fetchImpl: typeof fetch, options: { authEnabled?: boolean } = {}): Hono {
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
    }),
  );
  return app;
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
