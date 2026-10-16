import { createServer } from 'node:http';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { MCPClient } from '@mastra/mcp';
import { Hono } from 'hono';
import type { Context } from 'hono';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createBoardRegistry } from '../boards/index.js';
import { PLATFORM_AUTH_PROVIDER } from '../platform-auth-host.js';
import type { RouteAuth } from '../routes/route.js';
import type { WorkItemRow } from '../storage/domains/work-items/base.js';
import type { FactoryToolDependencies } from '../tools/index.js';
import {
  buildFactoryMcpRoutes,
  connectorSessionId,
  PLATFORM_MCP_AUTHORIZATION_SERVER,
  resolveMcpAuthorizationServers,
} from './routes.js';
import type { FactoryMcpRoutesDeps } from './routes.js';

describe('resolveMcpAuthorizationServers', () => {
  it('prefers config, then env, then Platform AuthKit', () => {
    expect(resolveMcpAuthorizationServers(PLATFORM_AUTH_PROVIDER, { authorizationServers: ['https://a'] }, {})).toEqual(
      ['https://a'],
    );
    expect(
      resolveMcpAuthorizationServers(PLATFORM_AUTH_PROVIDER, undefined, {
        MASTRA_FACTORY_MCP_AUTHORIZATION_SERVER: 'https://e',
      }),
    ).toEqual(['https://e']);
    expect(resolveMcpAuthorizationServers(PLATFORM_AUTH_PROVIDER, undefined, {})).toEqual([
      PLATFORM_MCP_AUTHORIZATION_SERVER,
    ]);
  });

  it('treats a blank env var as unset', () => {
    expect(
      resolveMcpAuthorizationServers(PLATFORM_AUTH_PROVIDER, undefined, {
        MASTRA_FACTORY_MCP_AUTHORIZATION_SERVER: '  ',
      }),
    ).toEqual([PLATFORM_MCP_AUTHORIZATION_SERVER]);
    expect(
      resolveMcpAuthorizationServers('workos', undefined, { MASTRA_FACTORY_MCP_AUTHORIZATION_SERVER: '' }),
    ).toEqual([]);
  });

  it('returns nothing for other providers without config', () => {
    expect(resolveMcpAuthorizationServers('workos', undefined, {})).toEqual([]);
  });
});

const ITEM_ID = '7f3c2a10-1111-4222-8333-444455556666';

const USERS: Record<string, { orgId: string; userId: string }> = {
  'token-alice': { orgId: 'org-1', userId: 'alice' },
  'token-mallory': { orgId: 'org-2', userId: 'mallory' },
};

const item = {
  id: ITEM_ID,
  orgId: 'org-1',
  factoryProjectId: 'project-1',
  board: null,
  externalSource: null,
  claimKey: null,
  parentWorkItemId: null,
  title: 'Fix the login page',
  stages: ['intake'],
  stageHistory: [],
  sessions: {},
  metadata: null,
  triageType: null,
  autonomyArmedAt: null,
  plansPreapprovedAt: null,
  acceptedAt: null,
  commentCount: 0,
  feedActivityAt: null,
  revision: 1,
  createdBy: 'alice',
  createdAt: new Date('2026-10-01T00:00:00Z'),
  updatedAt: new Date('2026-10-01T00:00:00Z'),
} as unknown as WorkItemRow;

function setup(overrides: Partial<FactoryMcpRoutesDeps> = {}) {
  const tenants = new WeakMap<Context, { orgId: string; userId: string }>();
  const auth: RouteAuth = {
    enabled: () => true,
    ensureUser: async c => {
      const token = c.req.header('Authorization')?.replace(/^Bearer /, '');
      const user = token ? USERS[token] : undefined;
      if (user) tenants.set(c, user);
      return user;
    },
    tenant: c => tenants.get(c),
    isOrganizationAdmin: async () => false,
  };
  const subscribeToWorkItem = vi.fn(async (args: Record<string, unknown>) => ({ ...args, reason: args.reason }));
  const workItems = {
    list: vi.fn(async ({ orgId, factoryProjectId }) =>
      [item].filter(row => row.orgId === orgId && row.factoryProjectId === factoryProjectId),
    ),
    getForProject: vi.fn(async (orgId, factoryProjectId, id) =>
      item.orgId === orgId && item.factoryProjectId === factoryProjectId && item.id === id ? item : null,
    ),
    listByIds: vi.fn(async () => []),
    listRunBindings: vi.fn(async () => []),
    listDeferredDecisions: vi.fn(async () => []),
    listDecisionsForEvaluations: vi.fn(async () => []),
    listWorkItemSubscribers: vi.fn(async () => []),
    listSessionSubscriptions: vi.fn(async () => []),
    subscribeToWorkItem,
  };
  const tools = {
    workItems,
    comments: { listRecent: vi.fn(async () => []) },
    audit: { list: vi.fn(async () => ({ events: [] })) },
    boards: createBoardRegistry(),
    sessions: { getBySessionId: vi.fn(async () => null), getSourceControlBySessionId: vi.fn(async () => null) },
  } as unknown as FactoryToolDependencies;
  const deps: FactoryMcpRoutesDeps = {
    auth,
    publicOrigin: 'https://factory.example.com',
    authorizationServers: ['https://auth.example.com'],
    projects: {
      get: vi.fn(async ({ orgId, id }) =>
        orgId === 'org-1' && id === 'project-1' ? ({ id, orgId, name: 'Acme' } as never) : null,
      ),
    },
    sourceControls: [],
    tools,
    ...overrides,
  };
  const app = new Hono();
  for (const route of buildFactoryMcpRoutes(deps)) {
    app.on(route.method === 'ALL' ? ['GET', 'POST', 'DELETE'] : [route.method], route.path, c =>
      (route as { handler: (c: Context) => Promise<Response> | Response }).handler(c),
    );
  }
  return { app, subscribeToWorkItem };
}

const servers: Server[] = [];
const clients: MCPClient[] = [];
afterEach(async () => {
  await Promise.all(clients.splice(0).map(client => client.disconnect()));
  await Promise.all(servers.splice(0).map(server => new Promise(resolve => server.close(resolve))));
});

/** Serve a Hono app over a real HTTP port so the MCP client talks to it end to end. */
async function serve(app: Hono): Promise<string> {
  const server = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (typeof value === 'string') headers.set(key, value);
    }
    const response = await app.fetch(
      new Request(`http://${req.headers.host}${req.url}`, {
        method: req.method,
        headers,
        body: chunks.length ? Buffer.concat(chunks) : undefined,
      }),
    );
    res.writeHead(response.status, Object.fromEntries(response.headers));
    if (response.body) for await (const chunk of response.body) res.write(chunk);
    res.end();
  });
  servers.push(server);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

function client(url: string, token: string): MCPClient {
  const mcp = new MCPClient({
    id: `factory-mcp-test-${Math.random()}`,
    servers: {
      factory: { url: new URL(url), requestInit: { headers: { Authorization: `Bearer ${token}` } } },
    },
  });
  clients.push(mcp);
  return mcp;
}

const mcpUrl = (base: string, project = 'project-1') => `${base}/web/factory/projects/${project}/mcp`;

describe('Factory MCP server', () => {
  it('rejects anonymous callers with a pointer to the OAuth metadata', async () => {
    const base = await serve(setup().app);
    const response = await fetch(mcpUrl(base), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    });
    expect(response.status).toBe(401);
    const challenge = response.headers.get('WWW-Authenticate');
    expect(challenge).toContain(
      'resource_metadata="https://factory.example.com/.well-known/oauth-protected-resource/web/factory/projects/project-1/mcp"',
    );

    const metadata = await fetch(`${base}/.well-known/oauth-protected-resource/web/factory/projects/project-1/mcp`);
    expect(await metadata.json()).toMatchObject({
      resource: 'https://factory.example.com/web/factory/projects/project-1/mcp',
      authorization_servers: ['https://auth.example.com'],
    });
  });

  it('lists the Factory tools with annotations and runs a read tool', async () => {
    const base = await serve(setup().app);
    const tools = await client(mcpUrl(base), 'token-alice').listTools();

    expect(Object.keys(tools)).toEqual(
      expect.arrayContaining([
        'factory_search',
        'factory_fetch',
        'factory_factory_list_work_items',
        'factory_factory_subscribe_work_item',
      ]),
    );
    expect(Object.keys(tools)).not.toContain('factory_factory_message_origin');
    // No connected repository, so the connector session has no row to start sub-sessions under.
    expect(Object.keys(tools)).not.toContain('factory_factory_start_session');

    const result = (await tools.factory_search!.execute!({ query: 'login' }, {} as never)) as {
      content: Array<{ text: string }>;
    };
    expect(JSON.parse(result.content[0]!.text)).toEqual({
      results: [
        {
          id: ITEM_ID,
          title: 'Fix the login page',
          url: `https://factory.example.com/factory/project-1/work-items/${ITEM_ID}`,
        },
      ],
    });
  });

  it('runs a write tool from the caller’s connector session', async () => {
    const { app, subscribeToWorkItem } = setup();
    const base = await serve(app);
    const tools = await client(mcpUrl(base), 'token-alice').listTools();

    await tools.factory_factory_subscribe_work_item!.execute!({ workItem: ITEM_ID }, {} as never);

    const sessionId = connectorSessionId('org-1', 'alice', 'project-1');
    expect(subscribeToWorkItem).toHaveBeenCalledWith(
      expect.objectContaining({ orgId: 'org-1', workItemId: ITEM_ID, userId: 'alice', sessionId }),
    );
  });

  it('denies a user from another organization', async () => {
    const base = await serve(setup().app);
    const response = await fetch(mcpUrl(base), {
      method: 'POST',
      headers: {
        Authorization: 'Bearer token-mallory',
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    });
    expect(response.status).toBe(404);
  });
});
