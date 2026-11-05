import { MCPClient } from '@mastra/mcp';
import { Hono } from 'hono';
import { describe, expect, it, onTestFinished, vi } from 'vitest';

import { McpServersRuntime } from '../mcp-servers/runtime.js';
import { startTestMcpServer } from '../mcp-servers/test-utils.js';
import { createFactorySecretEncryption } from '../secret-encryption.js';
import type { McpServersStorage } from '../storage/domains/mcp-servers/base.js';
import { createFactoryStorageForTests } from '../storage/test-utils.js';
import type { McpServerInfo } from './mcp-servers.js';
import { McpServerRoutes } from './mcp-servers.js';
import { fakeRouteAuth, mountApiRoutes } from './test-utils.js';
import type { TestAuthUser } from './test-utils.js';

const TOKEN = 'route-test-token-0c9e41b7';
const CLIENT_SECRET = 'route-test-client-secret-77aa1f';

const admin: TestAuthUser = { workosId: 'admin-a', organizationId: 'org-a' };
const member: TestAuthUser = { workosId: 'member-a', organizationId: 'org-a' };
const otherOrgAdmin: TestAuthUser = { workosId: 'admin-b', organizationId: 'org-b' };
const ADMINS = new Set(['admin-a', 'admin-b']);

async function setup({
  enabled = true,
  withStorage = true,
  publicOrigin = 'https://factory.example.com',
}: { enabled?: boolean; withStorage?: boolean; publicOrigin?: string } = {}) {
  const { storage: backend, mcpServers } = await createFactoryStorageForTests();
  const runtime = new McpServersRuntime({ storage: mcpServers, allowPrivateNetwork: true });
  onTestFinished(() => runtime.close());
  const routes = new McpServerRoutes({
    auth: fakeRouteAuth({ enabled, isOrganizationAdmin: async (_orgId, userId) => ADMINS.has(userId) }),
    storage: withStorage ? mcpServers : undefined,
    runtime,
    allowPrivateNetwork: true,
    publicOrigin,
  }).routes();

  const appFor = (user: TestAuthUser | null) => {
    const app = new Hono();
    app.use('*', async (c, next) => {
      if (user) c.set('factoryAuthUser' as never, user as never);
      await next();
    });
    mountApiRoutes(app as never, routes);
    return app;
  };
  const request = (user: TestAuthUser | null, method: string, path: string, body?: unknown) =>
    appFor(user).request(`/web/config/mcp-servers${path}`, {
      method,
      ...(body === undefined ? {} : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
    });
  return { backend, storage: mcpServers, runtime, request };
}

type Ctx = Awaited<ReturnType<typeof setup>>;

function bearerBody(url: string, name = 'Docs', token = TOKEN) {
  return { name, url, authType: 'headers', headers: [{ name: 'Authorization', value: `Bearer ${token}` }] };
}

async function createServer(ctx: Ctx, user: TestAuthUser | null, body: unknown): Promise<McpServerInfo> {
  const response = await ctx.request(user, 'POST', '', body);
  expect(response.status).toBe(201);
  return ((await response.json()) as { server: McpServerInfo }).server;
}

async function rawRow(storage: McpServersStorage, orgId: string, id: string) {
  return JSON.stringify(await storage.get({ orgId, id }));
}

describe('MCP server routes', () => {
  it('lets an admin add, list, edit, and remove a server without ever returning its credentials', async () => {
    const ctx = await setup();
    const responses: string[] = [];
    const json = async (response: Response) => {
      const text = await response.text();
      responses.push(text);
      return JSON.parse(text);
    };

    const created = await ctx.request(admin, 'POST', '', bearerBody('https://mcp.example.com/mcp'));
    expect(created.status).toBe(201);
    const { server } = await json(created);
    expect(server).toEqual({
      id: expect.any(String),
      name: 'Docs',
      slug: 'docs',
      url: 'https://mcp.example.com/mcp',
      authType: 'headers',
      headerNames: ['Authorization'],
      status: 'unknown',
      lastError: null,
      discoveredAt: null,
      tools: [],
    });

    const listed = await json(await ctx.request(admin, 'GET', ''));
    expect(listed).toEqual({
      servers: [server],
      canManage: true,
      oauth: { metadataDocument: true, redirectUri: 'https://factory.example.com/auth/mcp-servers/callback' },
    });

    const renamed = await ctx.request(admin, 'PATCH', `/${server.id}`, { name: 'Docs search' });
    expect(renamed.status).toBe(200);
    expect((await json(renamed)).server).toMatchObject({
      name: 'Docs search',
      slug: 'docs',
      headerNames: ['Authorization'],
    });

    const oauth = await ctx.request(admin, 'PATCH', `/${server.id}`, {
      authType: 'oauth',
      oauth: { clientId: 'factory-client', clientSecret: CLIENT_SECRET, scopes: ['read'] },
    });
    expect(oauth.status).toBe(200);
    expect((await json(oauth)).server).toMatchObject({
      authType: 'oauth',
      headerNames: [],
      oauth: { clientId: 'factory-client', hasClientSecret: true, scopes: ['read'], connected: false },
    });
    await json(await ctx.request(admin, 'GET', ''));

    const removed = await ctx.request(admin, 'DELETE', `/${server.id}`);
    expect(removed.status).toBe(200);
    expect((await json(await ctx.request(admin, 'GET', ''))).servers).toEqual([]);
    expect(await ctx.storage.get({ orgId: 'org-a', id: server.id })).toBeNull();

    for (const text of responses) {
      expect(text).not.toContain(TOKEN);
      expect(text).not.toContain(CLIENT_SECRET);
    }
  });

  it('connects a server, lists its tools, and saves the tool selection', async () => {
    const mcp = await startTestMcpServer({ bearerToken: TOKEN });
    const ctx = await setup();
    const server = await createServer(ctx, admin, bearerBody(mcp.url));

    const discovered = await ctx.request(admin, 'POST', `/${server.id}/discover`);
    expect(discovered.status).toBe(200);
    const text = await discovered.text();
    expect(text).not.toContain(TOKEN);
    const connected = (JSON.parse(text) as { server: McpServerInfo }).server;
    expect(connected).toMatchObject({ status: 'connected', lastError: null, discoveredAt: expect.any(String) });
    expect(connected.tools).toEqual([
      { name: 'add', exposedName: 'docs_add', description: 'Add two numbers.', selected: true, isNew: false },
      { name: 'echo', exposedName: 'docs_echo', description: 'Echo text back.', selected: true, isNew: false },
    ]);

    const saved = await ctx.request(admin, 'PUT', `/${server.id}/tools`, { selected: ['echo'] });
    expect(saved.status).toBe(200);
    const selection = ((await saved.json()) as { server: McpServerInfo }).server.tools.map(tool => [
      tool.name,
      tool.selected,
    ]);
    expect(selection).toEqual([
      ['add', false],
      ['echo', true],
    ]);
    expect((await ctx.storage.get({ orgId: 'org-a', id: server.id }))!.selectedTools).toEqual(['echo']);
  });

  it('marks a server that rejects its credentials as needing sign-in', async () => {
    const mcp = await startTestMcpServer({ bearerToken: TOKEN });
    const ctx = await setup();
    const server = await createServer(ctx, admin, bearerBody(mcp.url, 'Docs', 'wrong-token-3f1d'));

    const response = await ctx.request(admin, 'POST', `/${server.id}/discover`);

    expect(response.status).toBe(200);
    expect(((await response.json()) as { server: McpServerInfo }).server).toMatchObject({
      status: 'needs_auth',
      lastError: 'The server rejected the saved credentials (HTTP 401). Update the headers and connect again.',
      tools: [],
    });
    expect(mcp.calls).toEqual([]);
  });

  it('refuses tool selections that name tools the server does not have', async () => {
    const mcp = await startTestMcpServer({ bearerToken: TOKEN });
    const ctx = await setup();
    const server = await createServer(ctx, admin, bearerBody(mcp.url));
    await ctx.request(admin, 'POST', `/${server.id}/discover`);

    const response = await ctx.request(admin, 'PUT', `/${server.id}/tools`, {
      selected: ['echo', 'delete_everything'],
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'invalid_mcp_server',
      message: "Unknown tools: delete_everything. Refresh the server's tools and try again.",
    });
    expect((await ctx.storage.get({ orgId: 'org-a', id: server.id }))!.selectedTools.sort()).toEqual(['add', 'echo']);
  });

  it("refuses selecting object built-ins like `toString`, which would break every server's tools", async () => {
    const mcp = await startTestMcpServer({ bearerToken: TOKEN });
    const ctx = await setup();
    const server = await createServer(ctx, admin, bearerBody(mcp.url));
    await ctx.request(admin, 'POST', `/${server.id}/discover`);

    for (const name of ['toString', 'constructor', '__proto__']) {
      const response = await ctx.request(admin, 'PUT', `/${server.id}/tools`, { selected: ['echo', name] });
      expect(response.status).toBe(400);
    }
    const { tools } = await ctx.runtime.toolsFor({ orgId: 'org-a', existingNames: new Set() });
    expect(Object.keys(tools).sort()).toEqual(['docs_add', 'docs_echo']);
  });

  it('requires the headers again when the server moves to another origin', async () => {
    const ctx = await setup();
    const server = await createServer(ctx, admin, bearerBody('https://mcp.example.com/mcp'));

    const moved = await ctx.request(admin, 'PATCH', `/${server.id}`, { url: 'https://attacker.example.net/mcp' });

    expect(moved.status).toBe(400);
    expect(await moved.json()).toEqual({
      error: 'invalid_mcp_server',
      message: 'Enter the headers again when you change the server address.',
    });
    expect((await ctx.storage.get({ orgId: 'org-a', id: server.id }))!.url).toBe('https://mcp.example.com/mcp');

    const resent = await ctx.request(admin, 'PATCH', `/${server.id}`, {
      url: 'https://mcp2.example.com/mcp',
      headers: [{ name: 'Authorization', value: 'Bearer new-token-55' }],
    });
    expect(resent.status).toBe(200);
    expect(((await resent.json()) as { server: McpServerInfo }).server.url).toBe('https://mcp2.example.com/mcp');
  });

  it('lets members see servers and tools but blocks every change for non-admins', async () => {
    const mcp = await startTestMcpServer({ bearerToken: TOKEN });
    const ctx = await setup();
    const server = await createServer(ctx, admin, bearerBody(mcp.url));
    await ctx.request(admin, 'POST', `/${server.id}/discover`);
    const before = await rawRow(ctx.storage, 'org-a', server.id);

    const listed = await ctx.request(member, 'GET', '');
    expect(listed.status).toBe(200);
    const view = (await listed.json()) as { servers: McpServerInfo[]; canManage: boolean };
    expect(view.canManage).toBe(false);
    expect(view.servers.map(item => [item.name, item.status, item.tools.length])).toEqual([['Docs', 'connected', 2]]);

    const attempts: Array<[string, string, unknown?]> = [
      ['POST', '', bearerBody('https://other.example.com/mcp', 'Other')],
      ['PATCH', `/${server.id}`, { name: 'Renamed' }],
      ['DELETE', `/${server.id}`],
      ['POST', `/${server.id}/discover`],
      ['PUT', `/${server.id}/tools`, { selected: [] }],
    ];
    for (const [method, path, body] of attempts) {
      const response = await ctx.request(member, method, path, body);
      expect(response.status, `${method} ${path}`).toBe(403);
      expect(await response.json()).toEqual({
        error: 'organization_admin_required',
        message: 'Only organization admins can manage MCP servers.',
      });
    }

    expect(await rawRow(ctx.storage, 'org-a', server.id)).toBe(before);
    expect(await ctx.storage.list({ orgId: 'org-a' })).toHaveLength(1);
    expect(mcp.methods.filter(method => method === 'tools/list')).toHaveLength(1);
  });

  it("hides another organization's servers, even from that organization's admins", async () => {
    const ctx = await setup();
    const server = await createServer(ctx, admin, bearerBody('https://mcp.example.com/mcp'));
    const before = await rawRow(ctx.storage, 'org-a', server.id);

    const listed = (await (await ctx.request(otherOrgAdmin, 'GET', '')).json()) as { servers: McpServerInfo[] };
    expect(listed.servers).toEqual([]);

    const attempts: Array<[string, string, unknown?]> = [
      ['PATCH', `/${server.id}`, { name: 'Mine now' }],
      ['DELETE', `/${server.id}`],
      ['POST', `/${server.id}/discover`],
      ['PUT', `/${server.id}/tools`, { selected: [] }],
    ];
    for (const [method, path, body] of attempts) {
      const response = await ctx.request(otherOrgAdmin, method, path, body);
      expect(response.status, `${method} ${path}`).toBe(404);
    }
    expect(await rawRow(ctx.storage, 'org-a', server.id)).toBe(before);

    // The same name is free in another organization.
    await createServer(ctx, otherOrgAdmin, bearerBody('https://mcp.example.com/mcp'));
  });

  it('lets the local user manage servers when auth is disabled', async () => {
    const ctx = await setup({ enabled: false, publicOrigin: 'http://localhost:4111' });

    const server = await createServer(ctx, null, bearerBody('http://127.0.0.1:9/mcp'));

    const listed = await (await ctx.request(null, 'GET', '')).json();
    expect(listed).toEqual({
      servers: [server],
      canManage: true,
      oauth: { metadataDocument: false, redirectUri: 'http://localhost:4111/auth/mcp-servers/callback' },
    });
    expect(await ctx.storage.list({ orgId: 'local' })).toHaveLength(1);
    expect((await ctx.request(null, 'DELETE', `/${server.id}`)).status).toBe(200);
  });

  it('rejects a second server with the same name in the organization', async () => {
    const ctx = await setup();
    await createServer(ctx, admin, bearerBody('https://mcp.example.com/mcp'));

    const response = await ctx.request(admin, 'POST', '', bearerBody('https://mcp2.example.com/mcp', 'docs'));

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: 'mcp_server_exists',
      message: 'An MCP server named "docs" already exists in this organization. Choose a different name.',
    });
  });

  it('stops adding servers at the per-organization limit', async () => {
    const ctx = await setup();
    for (let index = 0; index < 50; index++) {
      await ctx.storage.create({
        orgId: 'org-a',
        userId: 'admin-a',
        input: {
          slug: `server-${index}`,
          name: `Server ${index}`,
          url: 'https://mcp.example.com/mcp',
          authType: 'none',
        },
      });
    }

    const response = await ctx.request(admin, 'POST', '', bearerBody('https://mcp.example.com/mcp', 'One more'));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'mcp_server_limit',
      message: 'An organization can have at most 50 MCP servers.',
    });
  });

  it('explains which field of a request is invalid', async () => {
    const ctx = await setup();

    const badUrl = await ctx.request(admin, 'POST', '', bearerBody('ftp://mcp.example.com/mcp'));
    const badHeader = await ctx.request(admin, 'POST', '', {
      name: 'Docs',
      url: 'https://mcp.example.com/mcp',
      authType: 'headers',
      headers: [{ name: 'Host', value: 'evil.example.com' }],
    });
    const notJson = await ctx.request(admin, 'POST', '', undefined);

    expect(badUrl.status).toBe(400);
    expect(await badUrl.json()).toMatchObject({ error: 'invalid_mcp_server', field: 'url' });
    expect(badHeader.status).toBe(400);
    expect(await badHeader.json()).toEqual({
      error: 'invalid_mcp_server',
      message: 'This header is set by the MCP connection and cannot be configured.',
      field: 'headers.0.name',
    });
    expect(notJson.status).toBe(400);
    expect(await ctx.storage.list({ orgId: 'org-a' })).toEqual([]);
  });

  it("refuses an edit whose credentials don't match the server's authentication instead of dropping them", async () => {
    const ctx = await setup();
    const bearer = await createServer(ctx, admin, bearerBody('https://mcp.example.com/mcp'));
    const oauth = await createServer(ctx, admin, {
      name: 'Identity',
      url: 'https://id.example.com/mcp',
      authType: 'oauth',
      oauth: { clientId: 'factory' },
    });

    const scopesOnBearer = await ctx.request(admin, 'PATCH', `/${bearer.id}`, { oauth: { scopes: ['read'] } });
    const headersOnOAuth = await ctx.request(admin, 'PATCH', `/${oauth.id}`, {
      headers: [{ name: 'X-Api-Key', value: 'key-that-would-be-lost' }],
    });

    expect(scopesOnBearer.status).toBe(400);
    expect(await scopesOnBearer.json()).toEqual({
      error: 'invalid_mcp_server',
      message: 'OAuth settings are only used with OAuth.',
    });
    expect(headersOnOAuth.status).toBe(400);
    expect(await headersOnOAuth.json()).toEqual({
      error: 'invalid_mcp_server',
      message: 'Headers are only used with header authentication.',
    });
    expect(await ctx.storage.get({ orgId: 'org-a', id: oauth.id })).toMatchObject({ authType: 'oauth', headers: null });
  });

  it('treats unknown or malformed server ids as not found', async () => {
    const ctx = await setup();

    expect((await ctx.request(admin, 'DELETE', '/not-a-uuid')).status).toBe(404);
    expect((await ctx.request(admin, 'POST', '/0b8f8f43-4c39-4bd0-9d2d-0f7a1f1b5c11/discover')).status).toBe(404);
  });

  it('requires a signed-in user when auth is enabled', async () => {
    const ctx = await setup();

    const response = await ctx.request(null, 'GET', '');

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'unauthorized' });
  });

  it('reports storage as unavailable when the app database is not configured', async () => {
    const ctx = await setup({ withStorage: false });

    const response = await ctx.request(admin, 'GET', '');

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: 'mcp_servers_unavailable' });
  });

  it('closes the open connection of a server when it is removed', async () => {
    const mcp = await startTestMcpServer({ bearerToken: TOKEN });
    const ctx = await setup();
    const server = await createServer(ctx, admin, bearerBody(mcp.url));
    await ctx.request(admin, 'POST', `/${server.id}/discover`);
    const { tools } = await ctx.runtime.toolsFor({ orgId: 'org-a', existingNames: new Set() });
    await tools.docs_echo!.execute!({ text: 'before removal' }, {} as never);
    const disconnect = vi.spyOn(MCPClient.prototype, 'disconnect');
    onTestFinished(() => disconnect.mockRestore());

    expect((await ctx.request(admin, 'DELETE', `/${server.id}`)).status).toBe(200);

    expect(disconnect).toHaveBeenCalledTimes(1);
    expect((await ctx.runtime.toolsFor({ orgId: 'org-a', existingNames: new Set() })).tools).toEqual({});
  });

  it('stops the tools a turn already has from calling a server once it is edited or removed', async () => {
    const mcp = await startTestMcpServer({ bearerToken: TOKEN });
    const ctx = await setup();
    const server = await createServer(ctx, admin, bearerBody(mcp.url));
    await ctx.request(admin, 'POST', `/${server.id}/discover`);
    const turn = async () => (await ctx.runtime.toolsFor({ orgId: 'org-a', existingNames: new Set() })).tools;
    const changed = `MCP server "Docs" was changed or removed after this turn started; its tools can no longer be called in this turn.`;

    const first = await turn();
    await first.docs_echo!.execute!({ text: 'before the edit' }, {} as never);
    expect((await ctx.request(admin, 'PATCH', `/${server.id}`, { name: 'Docs search' })).status).toBe(200);
    await expect(first.docs_echo!.execute!({ text: 'after the edit' }, {} as never)).rejects.toThrow(changed);

    // The next turn gets the edited server's tools again.
    const second = await turn();
    await second.docs_echo!.execute!({ text: 'next turn' }, {} as never);
    expect((await ctx.request(admin, 'DELETE', `/${server.id}`)).status).toBe(200);
    await expect(second.docs_echo!.execute!({ text: 'after removal' }, {} as never)).rejects.toThrow(
      changed.replace('"Docs"', '"Docs search"'),
    );

    expect(mcp.calls.map(call => call.args)).toEqual([{ text: 'before the edit' }, { text: 'next turn' }]);
    // Nothing reconnected behind the runtime's back.
    expect(mcp.methods.filter(method => method === 'server/discover' || method === 'initialize')).toHaveLength(3);
  });

  it('does not save a connection made with headers an admin replaced while it was connecting', async () => {
    const mcp = await startTestMcpServer({ bearerToken: TOKEN });
    const ctx = await setup();
    const server = await createServer(ctx, admin, bearerBody(mcp.url));

    const held = mcp.holdNextRequest();
    const discovering = ctx.request(admin, 'POST', `/${server.id}/discover`);
    await held.arrived;
    const patch = await ctx.request(admin, 'PATCH', `/${server.id}`, {
      headers: [{ name: 'Authorization', value: 'Bearer mistyped-token' }],
    });
    expect(patch.status).toBe(200);
    held.release();

    const response = await discovering;
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ message: 'The server changed while connecting. Connect again.' });
    expect(await ctx.storage.get({ orgId: 'org-a', id: server.id })).toMatchObject({
      status: 'unknown',
      toolCatalog: null,
    });
  });

  it('cuts off a call still using the old credentials when an admin rotates them, and the new connection works', async () => {
    const mcp = await startTestMcpServer({ bearerToken: TOKEN });
    const ctx = await setup();
    const server = await createServer(ctx, admin, bearerBody(mcp.url));
    await ctx.request(admin, 'POST', `/${server.id}/discover`);
    const turnA = await ctx.runtime.toolsFor({ orgId: 'org-a', existingNames: new Set() });
    await turnA.tools.docs_echo!.execute!({ text: 'connected' }, {} as never);

    // Turn A's next call is on the way with the old token while an admin rotates it and reconnects.
    const held = mcp.holdNextRequest();
    const call = turnA.tools.docs_echo!.execute!({ text: 'old token' }, {} as never).catch((error: unknown) => error);
    await held.arrived;
    await ctx.request(admin, 'PATCH', `/${server.id}`, {
      headers: [{ name: 'Authorization', value: 'Bearer rotated-token-8d2f' }],
    });
    mcp.acceptToken('rotated-token-8d2f');
    expect((await ctx.request(admin, 'POST', `/${server.id}/discover`)).status).toBe(200);
    const turnB = await ctx.runtime.toolsFor({ orgId: 'org-a', existingNames: new Set() });
    held.release();
    // Reconnecting closed the old connection under the call; it isn't resent, since it may have run.
    expect(await call).toMatchObject({
      message: expect.stringContaining('failed before tool "echo" returned a result'),
    });

    const result = await turnB.tools.docs_echo!.execute!({ text: 'new token' }, {} as never);
    expect(JSON.stringify(result)).toContain('new token');
    expect(await ctx.storage.get({ orgId: 'org-a', id: server.id })).toMatchObject({ status: 'connected' });
  });

  it('does not mark a server as needing sign-in when another replica just replaced the refused credentials', async () => {
    const mcp = await startTestMcpServer({ bearerToken: TOKEN });
    const ctx = await setup();
    const server = await createServer(ctx, admin, bearerBody(mcp.url));
    await ctx.request(admin, 'POST', `/${server.id}/discover`);
    // A session on another replica, sharing only the database.
    const replica = new McpServersRuntime({ storage: ctx.storage, allowPrivateNetwork: true });
    onTestFinished(() => replica.close());
    const { tools } = await replica.toolsFor({ orgId: 'org-a', existingNames: new Set() });

    // Its call is on the way with the old token while an admin rotates it.
    const held = mcp.holdNextRequest();
    const call = tools.docs_echo!.execute!({ text: 'old token' }, {} as never).catch((error: unknown) => error);
    await held.arrived;
    const rotated = await ctx.request(admin, 'PATCH', `/${server.id}`, {
      headers: [{ name: 'Authorization', value: 'Bearer rotated-token-8d2f' }],
    });
    expect(rotated.status).toBe(200);
    mcp.acceptToken('rotated-token-8d2f');
    held.release();

    expect(await call).toBeInstanceOf(Error);
    expect(mcp.calls).toEqual([]);
    expect(await ctx.storage.get({ orgId: 'org-a', id: server.id })).toMatchObject({
      status: 'unknown',
      lastError: null,
    });
  });

  it("keeps every other server working, and the server fixable, when this instance can't read its credentials", async () => {
    const docsServer = await startTestMcpServer({ bearerToken: TOKEN });
    const crmServer = await startTestMcpServer({ bearerToken: TOKEN });
    const ctx = await setup();
    const docs = await createServer(ctx, admin, bearerBody(docsServer.url));
    const crm = await createServer(ctx, admin, bearerBody(crmServer.url, 'CRM'));
    const old = await createServer(ctx, admin, bearerBody('https://old.example.com/mcp', 'Old'));
    for (const server of [docs, crm])
      expect((await ctx.request(admin, 'POST', `/${server.id}/discover`)).status).toBe(200);
    // An instance with an encryption key this one lacks saved new credentials for two of them.
    const otherInstance = createFactorySecretEncryption({
      primary: { id: 'other-instance', key: Buffer.alloc(32, 3) },
    });
    const foreign = await otherInstance.encrypt({ Authorization: `Bearer ${TOKEN}` });
    for (const server of [crm, old])
      await ctx.backend.ops.updateMany('mcp_servers', { id: server.id }, { headers: foreign });
    const crmRequests = crmServer.methods.length;

    const listed = await ctx.request(member, 'GET', '');
    expect(listed.status).toBe(200);
    const { servers } = (await listed.json()) as { servers: McpServerInfo[] };
    const unreadable = {
      status: 'error',
      lastError:
        "This Factory can't read the server's saved credentials. Give every Factory instance the same secret encryption keys, or enter the credentials again.",
      headerNames: [],
    };
    expect(servers.find(s => s.id === docs.id)).toMatchObject({ status: 'connected', headerNames: ['Authorization'] });
    expect(servers.find(s => s.id === crm.id)).toMatchObject(unreadable);

    // Sessions keep the readable server's tools.
    const { tools, skipped } = await ctx.runtime.toolsFor({ orgId: 'org-a', existingNames: new Set() });
    expect(Object.keys(tools).sort()).toEqual(['docs_add', 'docs_echo']);
    expect(skipped).toEqual(
      ['echo', 'add'].map(toolName => ({
        serverId: crm.id,
        toolName,
        exposedName: `crm_${toolName}`,
        reason: 'credentials_unreadable',
      })),
    );

    // Connecting without the credentials is refused, and leaves what the other instances see alone.
    const refused = await ctx.request(admin, 'POST', `/${crm.id}/discover`);
    expect(refused.status).toBe(409);
    expect(await refused.json()).toEqual({ error: 'mcp_server_credentials_unreadable', message: unreadable.lastError });
    expect(crmServer.methods.length).toBe(crmRequests);
    expect(await ctx.storage.get({ orgId: 'org-a', id: crm.id })).toMatchObject({
      status: 'connected',
      lastError: null,
    });

    // Nor does it sign in with a client secret it can't read.
    const tracker = await createServer(ctx, admin, {
      name: 'Tracker',
      url: 'https://tracker.example.com/mcp',
      authType: 'oauth',
      oauth: { clientId: 'factory-client', clientSecret: CLIENT_SECRET },
    });
    await ctx.backend.ops.updateMany(
      'mcp_servers',
      { id: tracker.id },
      { oauth_client_secret: await otherInstance.encrypt(CLIENT_SECRET) },
    );
    expect((await ctx.request(admin, 'POST', `/${tracker.id}/oauth/start`, {})).status).toBe(409);

    // An admin can remove one, and fix the other by entering its credentials again.
    expect((await ctx.request(admin, 'DELETE', `/${old.id}`)).status).toBe(200);
    const fixed = await ctx.request(admin, 'PATCH', `/${crm.id}`, {
      headers: [{ name: 'Authorization', value: `Bearer ${TOKEN}` }],
    });
    expect(fixed.status).toBe(200);
    expect(((await fixed.json()) as { server: McpServerInfo }).server).toMatchObject({
      status: 'unknown',
      headerNames: ['Authorization'],
    });
    expect((await ctx.request(admin, 'POST', `/${crm.id}/discover`)).status).toBe(200);
    const after = await ctx.runtime.toolsFor({ orgId: 'org-a', existingNames: new Set() });
    expect(Object.keys(after.tools).sort()).toEqual(['crm_add', 'crm_echo', 'docs_add', 'docs_echo']);
  });
});
