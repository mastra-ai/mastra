import { MASTRA_RESOURCE_ID_KEY } from '@mastra/core/request-context';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PROVIDERS } from '../registry.js';
import type { ProviderRegistration } from '../registry.js';
import { __clearSharedToolsStateForTests, tools as connect } from '../tools.js';
import { userConnectRoutes } from '../user-connect-routes.js';

// Test-only seam: the shipped barrel exports a readonly view; tests mutate the
// underlying array to install fixture providers.
const testProviders = PROVIDERS as ProviderRegistration[];

const PROJECT_ID = 'proj_1';
const RESOURCE_ID = 'end-user-42';

function installProvider(integrationId: string) {
  testProviders.push({
    integrationId,
    envVar: `MASTRA_${integrationId.toUpperCase()}_CONNECTION_ID`,
    createTools: () => ({ [`${integrationId}_fake_tool`]: { id: `${integrationId}_fake_tool` } }) as never,
  });
}

function makeConnection(overrides: Record<string, unknown>) {
  return {
    id: 'c_lin1',
    integrationId: 'linear',
    status: 'active',
    connectedByUserId: null,
    connectedAt: '2026-09-01T00:00:00Z',
    createdAt: '2026-09-01T00:00:00Z',
    accountLabel: 'Acme',
    resourceId: RESOURCE_ID,
    ...overrides,
  };
}

/**
 * One platform shared by the tool resolver and the connect routes, the way a
 * dev server runs both against the same project. The connection list is
 * mutable so a test can land a connection the way the OAuth handshake does.
 */
function sharedPlatform() {
  const connections: Array<Record<string, unknown>> = [];
  let connectionListCount = 0;
  /** When set, connection lists read the rows now but respond only once it resolves. */
  let holdLists: Promise<void> | undefined;
  /** Hold only the next connection list, letting later ones through. */
  let holdOnce = false;
  const fetchMock = vi.fn().mockImplementation(async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = init?.method ?? 'GET';
    if (url.pathname === '/v2/integrations') return Response.json({ integrations: [] });
    if (url.pathname === `/v2/projects/${PROJECT_ID}/integration-settings`) {
      return Response.json({ endUserProviders: null });
    }
    if (url.pathname.endsWith('/connections') && method === 'GET') {
      connectionListCount += 1;
      const resourceId = url.searchParams.get('resourceId');
      const rows = connections.filter(
        connection => connection.resourceId === null || connection.resourceId === resourceId,
      );
      const hold = holdLists;
      if (holdOnce) holdLists = undefined;
      await hold;
      return Response.json({ connections: rows });
    }
    if (method === 'DELETE') {
      const id = url.pathname.split('/connections/')[1];
      const index = connections.findIndex(connection => connection.id === id);
      if (index >= 0) connections.splice(index, 1);
      return new Response(null, { status: 204 });
    }
    return Response.json({ error: 'unexpected route' }, { status: 500 });
  });
  const client = { accessToken: 'fake-test-token', baseUrl: 'https://example.test', fetch: fetchMock as typeof fetch };
  return {
    connections,
    client,
    connectionListCount: () => connectionListCount,
    holdConnectionLists: ({ once = false }: { once?: boolean } = {}) => {
      holdOnce = once;
      let release!: () => void;
      holdLists = new Promise(resolve => {
        release = resolve;
      });
      return () => {
        holdLists = undefined;
        release();
      };
    },
  };
}

/** Minimal Hono-shaped context covering what the handlers use. */
function makeCtx(params: Record<string, string>, resourceId = RESOURCE_ID) {
  const requestContext = { get: (key: string) => (key === MASTRA_RESOURCE_ID_KEY ? resourceId : undefined) };
  return {
    req: { param: (name: string) => params[name], query: () => undefined, header: () => undefined },
    get: (key: string) => (key === 'requestContext' ? requestContext : undefined),
    header: () => {},
    json: (obj: unknown, status = 200) => Response.json(obj, { status }),
    body: (data: string | null, status = 200) => new Response(data, { status }),
  };
}

function routeHandler(routes: ReturnType<typeof userConnectRoutes>, method: string, path: string) {
  const route = routes.find(candidate => candidate.method === method && candidate.path === path);
  if (!route || !('handler' in route)) throw new Error(`route not found: ${method} ${path}`);
  return route.handler as unknown as (c: ReturnType<typeof makeCtx>) => Promise<Response>;
}

function setup() {
  installProvider('linear');
  const platform = sharedPlatform();
  const resolver = connect({ projectId: PROJECT_ID, client: platform.client, resourceId: RESOURCE_ID });
  const routes = userConnectRoutes({ projectId: PROJECT_ID, client: platform.client });
  return {
    platform,
    resolver,
    status: (id: string, resourceId?: string) =>
      routeHandler(routes, 'GET', '/connect/connections/:id/status')(makeCtx({ id }, resourceId)),
    disconnect: (id: string) => routeHandler(routes, 'DELETE', '/connect/connections/:id')(makeCtx({ id })),
  };
}

beforeEach(() => {
  testProviders.length = 0;
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(async () => {
  testProviders.length = 0;
  vi.restoreAllMocks();
  vi.useRealTimers();
  await __clearSharedToolsStateForTests();
});

describe('connection freshness between the connect routes and the tool resolver', () => {
  describe('when a connection activates and its status is polled', () => {
    it('resolves the new provider tools on the next resolution, without waiting out the snapshot TTL', async () => {
      const { platform, resolver, status } = setup();
      expect(Object.keys(await resolver())).toEqual(['request_connection']);

      platform.connections.push(makeConnection({ id: 'c_new1' }));
      const response = await status('c_new1');
      expect(await response.json()).toMatchObject({ id: 'c_new1', status: 'active' });

      expect(Object.keys(await resolver()).sort()).toEqual(['linear_fake_tool', 'request_connection']);
    });
  });

  describe('when a resolution read the connection list just before the connection activated', () => {
    it('does not let that in-flight snapshot hide the new connection', async () => {
      const { platform, resolver, status } = setup();
      await resolver();
      // Expire the snapshot so the next resolution revalidates in the background.
      vi.useFakeTimers({ now: Date.now() + 60_000, toFake: ['Date'] });
      const release = platform.holdConnectionLists();
      await resolver();

      platform.connections.push(makeConnection({ id: 'c_new1' }));
      const polled = status('c_new1');
      release();
      await polled;

      expect(Object.keys(await resolver()).sort()).toEqual(['linear_fake_tool', 'request_connection']);
    });
  });

  describe('when the polled connection is still pending', () => {
    it('keeps serving the cached snapshot', async () => {
      const { platform, resolver, status } = setup();
      await resolver();
      platform.connections.push(makeConnection({ id: 'c_new1', status: 'pending' }));
      await status('c_new1');
      const listsBefore = platform.connectionListCount();

      await resolver();

      expect(platform.connectionListCount()).toBe(listsBefore);
    });
  });

  describe('when the snapshot already includes the active connection', () => {
    it('does not refetch on repeated status polls', async () => {
      const { platform, resolver, status } = setup();
      platform.connections.push(makeConnection({ id: 'c_lin1' }));
      expect(Object.keys(await resolver()).sort()).toEqual(['linear_fake_tool', 'request_connection']);
      await status('c_lin1');
      await status('c_lin1');
      const listsBefore = platform.connectionListCount();

      await resolver();

      expect(platform.connectionListCount()).toBe(listsBefore);
    });
  });

  describe('when the same activation is reported again while the refresh it triggered is in flight', () => {
    it('does not invalidate that refresh', async () => {
      const { platform, resolver, status } = setup();
      await resolver();
      platform.connections.push(makeConnection({ id: 'c_new1' }));
      await status('c_new1');
      // The refresh triggered by the first report started after it, so it already sees the connection.
      const release = platform.holdConnectionLists({ once: true });
      const refreshing = resolver();
      await status('c_new1');
      release();
      expect(Object.keys(await refreshing).sort()).toEqual(['linear_fake_tool', 'request_connection']);
      const listsBefore = platform.connectionListCount();

      await resolver();

      expect(platform.connectionListCount()).toBe(listsBefore);
    });
  });

  describe('when a connection comes back after it left the snapshot unreported', () => {
    it('picks the reactivation up on the next resolution', async () => {
      const { platform, resolver, status } = setup();
      await resolver();
      platform.connections.push(makeConnection({ id: 'c_new1' }));
      await status('c_new1');
      expect(Object.keys(await resolver())).toContain('linear_fake_tool');

      // Removed outside these routes (e.g. the platform dashboard): only the TTL refresh notices.
      platform.connections.length = 0;
      vi.useFakeTimers({ now: Date.now() + 60_000, toFake: ['Date'] });
      await resolver();
      await vi.waitFor(async () => expect(Object.keys(await resolver())).not.toContain('linear_fake_tool'));

      platform.connections.push(makeConnection({ id: 'c_new1' }));
      await status('c_new1');

      expect(Object.keys(await resolver())).toContain('linear_fake_tool');
    });
  });

  describe('when a global connection activates and a user polls it', () => {
    it('resolves its tools for that user on the next resolution', async () => {
      const { platform, resolver, status } = setup();
      expect(Object.keys(await resolver())).toEqual(['request_connection']);

      platform.connections.push(makeConnection({ id: 'c_global1', resourceId: null }));
      await status('c_global1');

      expect(Object.keys(await resolver()).sort()).toEqual(['linear_fake_tool', 'request_connection']);
    });
  });

  describe('when the user disconnects a connection through the routes', () => {
    it('drops its provider tools on the next resolution', async () => {
      const { platform, resolver, disconnect } = setup();
      platform.connections.push(makeConnection({ id: 'c_lin1' }));
      expect(Object.keys(await resolver()).sort()).toEqual(['linear_fake_tool', 'request_connection']);

      expect((await disconnect('c_lin1')).status).toBe(204);

      expect(Object.keys(await resolver())).toEqual(['request_connection']);
    });
  });

  describe('when another resource connects a provider', () => {
    it('leaves this resource’s snapshot untouched', async () => {
      const { platform, resolver, status } = setup();
      await resolver();
      platform.connections.push(makeConnection({ id: 'c_other', resourceId: 'end-user-other' }));
      await status('c_other', 'end-user-other');
      const listsBefore = platform.connectionListCount();

      await resolver();

      expect(platform.connectionListCount()).toBe(listsBefore);
    });
  });
});
