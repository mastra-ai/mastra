import { createServer } from 'node:http';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { EventEmitterPubSub } from '@mastra/core/events';
import { MCPClient } from '@mastra/mcp';
import { Hono } from 'hono';
import type { Context } from 'hono';
import { afterEach, describe, expect, it } from 'vitest';

import { createBoardRegistry } from '../boards/index.js';
import { PLATFORM_AUTH_PROVIDER } from '../platform-auth-host.js';
import type { RouteAuth } from '../routes/route.js';
import { FactoryTransitionService } from '../rules/transition-service.js';
import { createSourceControlSessionLookup } from '../session/factory-session.js';
import { AuditDomain } from '../storage/domains/audit/domain.js';
import { CommentsDomain } from '../storage/domains/comments/domain.js';
import { createFactoryStorageForTests } from '../storage/test-utils.js';
import type { FactoryToolDependencies } from '../tools/index.js';
import {
  buildFactoryMcpRoutes,
  connectorSessionId,
  PLATFORM_MCP_AUTHORIZATION_SERVER,
  resolveMcpAuthorizationServers,
} from './routes.js';

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

const PUBLIC_ORIGIN = 'https://factory.example.com';

/**
 * Bearer token → tenant. Platform's `/auth/verify` is the real boundary and
 * can't run here; everything behind it (projects, work items, sessions,
 * subscriptions, audit) is real Factory storage.
 */
const USERS: Record<string, { orgId?: string; userId: string }> = {
  'token-alice': { orgId: 'org-1', userId: 'alice' },
  'token-mallory': { orgId: 'org-2', userId: 'mallory' },
  'token-no-org': { userId: 'drifter' },
};

function tokenAuth(): RouteAuth {
  const tenants = new WeakMap<Context, { orgId?: string; userId: string }>();
  return {
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
}

async function setup() {
  const seed = await createFactoryStorageForTests();
  const auth = tokenAuth();
  const boards = createBoardRegistry();
  const sourceControl = seed.sourceControl.forIntegration('github');
  const auditDomain = new AuditDomain({ auth, audit: seed.audit, projects: seed.projects });
  const tools: FactoryToolDependencies = {
    workItems: seed.workItems,
    comments: seed.comments,
    feed: new CommentsDomain({
      auth,
      comments: seed.comments,
      workItems: seed.workItems,
      projects: seed.projects,
      audit: auditDomain,
      pubsub: new EventEmitterPubSub(),
    }),
    audit: seed.audit,
    boards,
    transitionService: new FactoryTransitionService({
      configVersion: 'mcp-test',
      boards,
      storage: seed.workItems,
      audit: auditDomain,
    }),
    auditRecorder: auditDomain,
    sessions: createSourceControlSessionLookup([sourceControl]),
    sessionModel: { projects: seed.projects, modelDefaults: seed.modelDefaults },
    intake: seed.intake,
    startCoordinator: () => undefined,
    // No live agent controller: nothing is mid-run.
    messaging: async () => null,
  };

  const project = await seed.projects.create({ orgId: 'org-1', userId: 'alice', input: { name: 'Acme' } });
  const { item } = await seed.workItems.upsert({
    orgId: 'org-1',
    userId: 'alice',
    factoryProjectId: project.id,
    input: { title: 'Fix the login page', stages: ['intake'], metadata: {} },
  });
  await seed.workItems.upsert({
    orgId: 'org-1',
    userId: 'alice',
    factoryProjectId: project.id,
    input: { title: 'Speed up the board', stages: ['intake'], metadata: {} },
  });

  const app = new Hono();
  const routes = buildFactoryMcpRoutes({
    auth,
    publicOrigin: PUBLIC_ORIGIN,
    authorizationServers: ['https://auth.example.com'],
    projects: seed.projects,
    // No repository is linked, so the connector session has no row to file.
    sourceControls: [sourceControl],
    tools,
  });
  for (const route of routes) {
    app.on([route.method], route.path, c =>
      (route as { handler: (c: Context) => Promise<Response> | Response }).handler(c),
    );
  }
  const base = await serve(app);
  return { ...seed, project, item, base, url: mcpUrl(base, project.id) };
}

const servers: Server[] = [];
const clients: MCPClient[] = [];
afterEach(async () => {
  await Promise.all(clients.splice(0).map(client => client.disconnect()));
  await Promise.all(servers.splice(0).map(server => new Promise(resolve => server.close(resolve))));
});

/** Serve a Hono app over a real HTTP port so MCP clients talk to it end to end. */
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

const mcpUrl = (base: string, project: string) => `${base}/web/factory/projects/${project}/mcp`;

const PROTOCOL_VERSION = '2026-07-28';

/**
 * One MCP `2026-07-28` request as Claude's connector sends it: the per-request
 * `_meta` envelope and the `Mcp-Protocol-Version` / `Mcp-Method` / `Mcp-Name`
 * headers derived from it. Shape copied from `@modelcontextprotocol/client`
 * 2.2.0 (`outboundEnvelope` for 2026-07-28 and `_applyBodyDerivedHeaders`).
 */
async function claudeRequest(
  url: string,
  method: string,
  params: Record<string, unknown> = {},
  token?: string,
): Promise<{ status: number; headers: Headers; body: { result?: any; error?: any } | null }> {
  const name = method === 'tools/call' ? (params.name as string) : undefined;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      'Mcp-Protocol-Version': PROTOCOL_VERSION,
      'Mcp-Method': method,
      ...(name ? { 'Mcp-Name': name } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method,
      params: {
        ...params,
        _meta: {
          'io.modelcontextprotocol/protocolVersion': PROTOCOL_VERSION,
          'io.modelcontextprotocol/clientInfo': { name: 'claude-ai', version: '0.1.0' },
          'io.modelcontextprotocol/clientCapabilities': {},
        },
      },
    }),
  });
  return { status: response.status, headers: response.headers, body: await readJsonRpc(response) };
}

/** A JSON-RPC reply, whether the server answered with JSON or a one-shot SSE stream. */
async function readJsonRpc(response: Response): Promise<{ result?: any; error?: any } | null> {
  const text = await response.text();
  if (!text) return null;
  if (!response.headers.get('Content-Type')?.includes('text/event-stream')) return JSON.parse(text);
  const messages = text
    .split('\n')
    .filter(line => line.startsWith('data:'))
    .map(line => JSON.parse(line.slice('data:'.length)));
  return messages.find(message => 'result' in message || 'error' in message) ?? null;
}

function toolText(result: { content: Array<{ type: string; text: string }> }): any {
  return JSON.parse(result.content.find(part => part.type === 'text')!.text);
}

describe('Factory MCP server', () => {
  it('Claude’s connector is sent to sign in', async () => {
    const { base, project, url } = await setup();

    const response = await claudeRequest(url, 'server/discover');

    expect(response.status).toBe(401);
    const challenge = response.headers.get('WWW-Authenticate') ?? '';
    const metadataUrl = /resource_metadata="([^"]+)"/.exec(challenge)?.[1];
    expect(metadataUrl).toBe(
      `${PUBLIC_ORIGIN}/.well-known/oauth-protected-resource/web/factory/projects/${project.id}/mcp`,
    );

    // The connector follows the pointer; this server answers it under its local address.
    const metadata = await fetch(`${base}${new URL(metadataUrl!).pathname}`);
    expect(metadata.status).toBe(200);
    expect(await metadata.json()).toEqual({
      resource: `${PUBLIC_ORIGIN}/web/factory/projects/${project.id}/mcp`,
      authorization_servers: ['https://auth.example.com'],
      bearer_methods_supported: ['header'],
      resource_name: 'Mastra Factory',
    });
  });

  it('Claude’s connector discovers the Factory and lists its tools', async () => {
    const { url } = await setup();

    const discover = await claudeRequest(url, 'server/discover', {}, 'token-alice');
    expect(discover.status).toBe(200);
    expect(discover.body?.error).toBeUndefined();
    expect(discover.body?.result.supportedVersions).toContain(PROTOCOL_VERSION);
    expect(discover.body?.result.capabilities.tools).toBeDefined();
    expect(discover.body?.result._meta['io.modelcontextprotocol/serverInfo']).toMatchObject({ name: 'Acme Factory' });

    const list = await claudeRequest(url, 'tools/list', {}, 'token-alice');
    expect(list.status).toBe(200);
    const tools = new Map<string, any>(list.body!.result.tools.map((tool: any) => [tool.name, tool]));
    for (const name of ['search', 'fetch', 'factory_list_work_items', 'factory_subscribe_work_item']) {
      expect(tools.has(name), name).toBe(true);
    }
    expect(tools.get('search').annotations).toMatchObject({ readOnlyHint: true, title: 'Search work items' });
    expect(tools.get('factory_list_work_items').annotations).toMatchObject({ readOnlyHint: true });
    expect(tools.has('factory_message_origin')).toBe(false);
    // No connected repository, so the connector session has no row to start sub-sessions under.
    expect(tools.has('factory_start_session')).toBe(false);
  });

  it('Claude sees what the Factory is for', async () => {
    const { url } = await setup();

    const discover = await claudeRequest(url, 'server/discover', {}, 'token-alice');
    const instructions: string = discover.body?.result.instructions;
    expect(instructions).toMatch(/Mastra Factory/);
    expect(instructions).toMatch(/signed-in user/);

    // Every tool the instructions point Claude at must be one it can call.
    const list = await claudeRequest(url, 'tools/list', {}, 'token-alice');
    const listed = new Set(list.body!.result.tools.map((tool: { name: string }) => tool.name));
    const named = [...instructions.matchAll(/`([a-z_]+)`/g)].map(match => match[1]);
    expect(named).toEqual(['factory_list_attention', 'search', 'fetch']);
    for (const name of named) expect(listed.has(name), name).toBe(true);
  });

  it('Claude calls a tool and reads real Factory data', async () => {
    const { url, project, item } = await setup();

    const search = await claudeRequest(
      url,
      'tools/call',
      { name: 'search', arguments: { query: 'login' } },
      'token-alice',
    );
    expect(search.status).toBe(200);
    expect(search.body?.result.isError).not.toBe(true);
    expect(toolText(search.body!.result)).toEqual({
      results: [
        {
          id: item.id,
          title: 'Fix the login page',
          url: `${PUBLIC_ORIGIN}/factory/${project.id}/work-items/${item.id}`,
        },
      ],
    });

    const fetched = await claudeRequest(
      url,
      'tools/call',
      { name: 'fetch', arguments: { id: item.id } },
      'token-alice',
    );
    expect(fetched.body?.result.isError).not.toBe(true);
    const document = toolText(fetched.body!.result);
    expect(document).toMatchObject({
      id: item.id,
      title: 'Fix the login page',
      url: `${PUBLIC_ORIGIN}/factory/${project.id}/work-items/${item.id}`,
      metadata: { factoryProjectId: project.id },
    });
    expect(JSON.parse(document.text).item).toMatchObject({ id: item.id, title: 'Fix the login page' });
  });

  it('a write from Claude lands on the caller’s connector session', async () => {
    const { url, project, item, workItems } = await setup();

    const call = await claudeRequest(
      url,
      'tools/call',
      { name: 'factory_subscribe_work_item', arguments: { workItem: item.id } },
      'token-alice',
    );
    expect(call.body?.result.isError).not.toBe(true);

    const sessionId = connectorSessionId('org-1', 'alice', project.id);
    const subscriptions = await workItems.listSessionSubscriptions({
      orgId: 'org-1',
      factoryProjectId: project.id,
      sessionId,
    });
    expect(subscriptions).toEqual([expect.objectContaining({ workItemId: item.id, sessionId, userId: 'alice' })]);
  });

  it('the Mastra MCP client lists and runs the same tools', async () => {
    const { url, item, project } = await setup();
    const tools = await client(url, 'token-alice').listTools();

    expect(Object.keys(tools)).toEqual(expect.arrayContaining(['factory_search', 'factory_fetch']));
    const result = (await tools.factory_search!.execute!({ query: 'login' }, {} as never)) as {
      content: Array<{ type: string; text: string }>;
    };
    expect(toolText(result).results).toEqual([
      { id: item.id, title: 'Fix the login page', url: `${PUBLIC_ORIGIN}/factory/${project.id}/work-items/${item.id}` },
    ]);
  });

  it('an older MCP client gets a clear unsupported-version error', async () => {
    const { url } = await setup();

    // A 2025-era opening: `initialize`, no `_meta` envelope, no 2026 headers.
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer token-alice',
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-11-25',
          capabilities: {},
          clientInfo: { name: 'vscode', version: '1.0.0' },
        },
      }),
    });
    const body = await readJsonRpc(response);

    expect(response.status).toBe(400);
    expect(body?.error).toMatchObject({
      message: 'Unsupported protocol version: 2025-11-25',
      data: { supported: [PROTOCOL_VERSION], requested: '2025-11-25' },
    });
  });

  it('denies a user from another organization', async () => {
    const { url } = await setup();
    const response = await claudeRequest(url, 'tools/list', {}, 'token-mallory');
    expect(response.status).toBe(404);
  });

  it('refuses a signed-in user without an organization', async () => {
    const { url } = await setup();
    const response = await claudeRequest(url, 'tools/list', {}, 'token-no-org');
    expect(response.status).toBe(403);
    expect(response.body).toEqual({ error: 'organization_required' });
  });
});

describe('Factory activity over MCP events', () => {
  const poll = (url: string, token: string, cursor: string | null, args: Record<string, unknown> = {}) =>
    claudeRequest(url, 'events/poll', { name: 'factory.activity', arguments: args, cursor }, token);

  const renameItem = (url: string, workItem: string, title: string) =>
    claudeRequest(
      url,
      'tools/call',
      { name: 'factory_update_work_item', arguments: { workItem, title } },
      'token-alice',
    );

  it('an MCP client finds the activity event type', async () => {
    const { url } = await setup();

    const list = await claudeRequest(url, 'events/list', {}, 'token-alice');

    expect(list.status).toBe(200);
    expect(list.body?.result.events).toEqual([
      expect.objectContaining({ name: 'factory.activity', delivery: ['poll'] }),
    ]);
  });

  it('an MCP client polling Factory activity sees new work item changes once', async () => {
    const { url, project, item, audit } = await setup();
    // Activity from before the client started polling is not replayed.
    await audit.record({
      orgId: 'org-1',
      actorId: 'alice',
      action: 'factory.work_item.created',
      targets: [{ type: 'work_item', id: item.id, name: item.title }],
      factoryProjectId: project.id,
    });

    const start = await poll(url, 'token-alice', null);
    expect(start.body?.result).toMatchObject({ events: [], cursor: expect.any(String) });

    const rename = await renameItem(url, item.id, 'Fix the sign-in page');
    expect(rename.body?.result.isError).not.toBe(true);

    const next = await poll(url, 'token-alice', start.body!.result.cursor);
    expect(next.body?.result.events).toEqual([
      expect.objectContaining({
        name: 'factory.activity',
        eventId: expect.any(String),
        data: {
          action: 'factory.work_item.updated',
          occurredAt: expect.any(String),
          actor: { type: 'human', id: 'alice' },
          workItemId: item.id,
          summary: expect.stringMatching(/^updated: /),
        },
      }),
    ]);

    const again = await poll(url, 'token-alice', next.body!.result.cursor);
    expect(again.body?.result.events).toEqual([]);
    expect(again.body?.result.cursor).toBe(next.body!.result.cursor);
  });

  it('a client with a cursor the Factory can’t read starts over from now and is told it may have missed events', async () => {
    const { url, item } = await setup();

    // Well-formed, but its id isn't an audit row id (Postgres would reject it in the query).
    const restart = await poll(url, 'token-alice', '2026-10-21T00:00:00.000Z_row-7');
    expect(restart.status).toBe(200);
    expect(restart.body?.result).toMatchObject({ events: [], truncated: true, cursor: expect.any(String) });

    await renameItem(url, item.id, 'Fix the sign-in page');
    const next = await poll(url, 'token-alice', restart.body!.result.cursor);
    expect(next.body?.result.events.map((event: any) => event.data.action)).toEqual(['factory.work_item.updated']);
  });

  it('activity from another org’s Factory never shows up', async () => {
    const { url, base, item, projects } = await setup();
    const globex = await projects.create({ orgId: 'org-2', userId: 'mallory', input: { name: 'Globex' } });
    const globexUrl = mcpUrl(base, globex.id);

    const start = await poll(globexUrl, 'token-mallory', null);
    await renameItem(url, item.id, 'Fix the sign-in page');
    const next = await poll(globexUrl, 'token-mallory', start.body!.result.cursor);
    expect(next.body?.result.events).toEqual([]);

    // Naming the other org's work item doesn't get her its activity either.
    const targeted = await poll(globexUrl, 'token-mallory', null, { workItemId: item.id });
    expect(targeted.body?.result).toBeUndefined();
    expect(targeted.body?.error).toMatchObject({ code: -32024 });
  });

  it('a private session’s activity isn’t visible to other users', async () => {
    const { url, project, item, audit } = await setup();
    const start = await poll(url, 'token-alice', null);

    // Another member's agent signals a private session: activity on the session, not on a work item.
    await audit.record({
      orgId: 'org-1',
      actorId: 'agent:thread-bob',
      actorType: 'agent',
      action: 'factory.agent.signaled',
      targets: [{ type: 'session', id: 'bob-private-session' }],
      metadata: { targetSessionId: 'bob-private-session' },
      factoryProjectId: project.id,
    });
    await renameItem(url, item.id, 'Fix the sign-in page');

    const next = await poll(url, 'token-alice', start.body!.result.cursor);
    expect(next.body?.result.events.map((event: { data: { action: string } }) => event.data.action)).toEqual([
      'factory.work_item.updated',
    ]);
    expect(JSON.stringify(next.body?.result)).not.toContain('bob-private-session');
  });
});
