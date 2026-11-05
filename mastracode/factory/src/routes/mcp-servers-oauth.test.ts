import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { LibSQLFactoryStorage } from '@mastra/libsql';
import { Hono } from 'hono';
import { afterEach, describe, expect, it, onTestFinished, vi } from 'vitest';

import { mcpOAuthEndpoints } from '../mcp-servers/oauth.js';
import { McpServersRuntime } from '../mcp-servers/runtime.js';
import { startTestAuthorizationServer, startTestMcpServer } from '../mcp-servers/test-utils.js';
import type { TestAuthorizationServer, TestMcpServer } from '../mcp-servers/test-utils.js';
import { createFactorySecretEncryption } from '../secret-encryption.js';
import { createStateSigner } from '../state-signing.js';
import { McpServersStorage } from '../storage/domains/mcp-servers/base.js';
import { createFactoryStorageForTests } from '../storage/test-utils.js';
import type { McpServerInfo } from './mcp-servers.js';
import { McpServerRoutes } from './mcp-servers.js';
import { fakeRouteAuth, mountApiRoutes } from './test-utils.js';
import type { TestAuthUser } from './test-utils.js';

const STATE_SECRET = 'mcp-oauth-route-test-state-secret';
const CLIENT_ID = 'factory-client';
const CLIENT_SECRET = 'oauth-route-client-secret-5d21c8';
const HTTP_ORIGIN = 'http://factory.test';
const HTTPS_ORIGIN = 'https://factory.example.com';

const admin: TestAuthUser = { workosId: 'admin-a', organizationId: 'org-a' };
const secondAdmin: TestAuthUser = { workosId: 'admin-a2', organizationId: 'org-a' };
const member: TestAuthUser = { workosId: 'member-a', organizationId: 'org-a' };
const otherOrgAdmin: TestAuthUser = { workosId: 'admin-b', organizationId: 'org-b' };

afterEach(() => {
  vi.useRealTimers();
});

/** One Factory replica: its own routes, runtime, and state signer over the given storage. */
function replica(
  storage: McpServersStorage,
  {
    publicOrigin = HTTP_ORIGIN,
    admins = new Set(['admin-a', 'admin-a2', 'admin-b']),
    withStateSigner = true,
  }: { publicOrigin?: string; admins?: Set<string>; withStateSigner?: boolean } = {},
) {
  const runtime = new McpServersRuntime({
    storage,
    allowPrivateNetwork: true,
    oauthEndpoints: mcpOAuthEndpoints(publicOrigin),
  });
  onTestFinished(() => runtime.close());
  const routes = new McpServerRoutes({
    auth: fakeRouteAuth({ isOrganizationAdmin: async (_orgId, userId) => admins.has(userId) }),
    storage,
    runtime,
    allowPrivateNetwork: true,
    publicOrigin,
    ...(withStateSigner ? { stateSigner: createStateSigner(STATE_SECRET) } : {}),
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
    appFor(user).request(path, {
      method,
      ...(body === undefined ? {} : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
    });
  return { runtime, admins, appFor, request };
}

type Replica = ReturnType<typeof replica>;

async function setup(options: Parameters<typeof replica>[1] = {}) {
  const { mcpServers } = await createFactoryStorageForTests();
  const authorizationServer = await startTestAuthorizationServer();
  const mcp = await startTestMcpServer({ authorizationServer });
  authorizationServer.preregister({
    clientId: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    redirectUris: [`${options.publicOrigin ?? HTTP_ORIGIN}/auth/mcp-servers/callback`],
  });
  return { storage: mcpServers, authorizationServer, mcp, ...replica(mcpServers, options) };
}

async function addOAuthServer(
  factory: Replica,
  mcp: TestMcpServer,
  oauth: Record<string, unknown> = { clientId: CLIENT_ID, clientSecret: CLIENT_SECRET },
  name = 'Orders',
): Promise<McpServerInfo> {
  const response = await factory.request(admin, 'POST', '/web/config/mcp-servers', {
    name,
    url: mcp.url,
    authType: 'oauth',
    oauth,
  });
  expect(response.status).toBe(201);
  return ((await response.json()) as { server: McpServerInfo }).server;
}

async function startSignIn(factory: Replica, serverId: string, user = admin, factoryProjectId = 'proj-1') {
  const response = await factory.request(user, 'POST', `/web/config/mcp-servers/${serverId}/oauth/start`, {
    factoryProjectId,
  });
  expect(response.status).toBe(200);
  return new URL(((await response.json()) as { authorizationUrl: string }).authorizationUrl);
}

/** The admin's browser at the authorization server: returns where it is sent back to. */
async function authorize(authorizationUrl: URL): Promise<URL> {
  const response = await fetch(authorizationUrl, { redirect: 'manual' });
  expect(response.status).toBe(302);
  return new URL(response.headers.get('location')!);
}

/** Deliver the authorization server's redirect to the Factory; returns where the Factory sends the browser. */
async function deliverCallback(factory: Replica, callback: URL, user: TestAuthUser | null = admin): Promise<string> {
  const response = await factory.appFor(user).request(`${callback.pathname}${callback.search}`);
  expect(response.status).toBe(302);
  return response.headers.get('location')!;
}

async function getServer(factory: Replica, id: string, user = admin): Promise<McpServerInfo> {
  const response = await factory.request(user, 'GET', '/web/config/mcp-servers');
  const { servers } = (await response.json()) as { servers: McpServerInfo[] };
  return servers.find(server => server.id === id)!;
}

describe('MCP server OAuth sign-in', () => {
  it('signs an admin in with a pre-registered client and connects the server for the organization', async () => {
    const ctx = await setup();
    const server = await addOAuthServer(ctx, ctx.mcp);

    // Connecting before signing in asks for sign-in; it never starts an authorization itself.
    const discover = await ctx.request(admin, 'POST', `/web/config/mcp-servers/${server.id}/discover`);
    expect(((await discover.json()) as { server: McpServerInfo }).server).toMatchObject({
      status: 'needs_auth',
      lastError: 'Sign in to connect this server.',
      oauth: { connected: false },
    });
    expect(ctx.authorizationServer.authorizeClientIds).toEqual([]);

    const authorizationUrl = await startSignIn(ctx, server.id);
    expect(authorizationUrl.origin).toBe(ctx.authorizationServer.issuer);
    expect(authorizationUrl.searchParams.get('client_id')).toBe(CLIENT_ID);
    expect(authorizationUrl.searchParams.get('redirect_uri')).toBe(`${HTTP_ORIGIN}/auth/mcp-servers/callback`);

    const callback = await authorize(authorizationUrl);
    expect(callback.origin).toBe(HTTP_ORIGIN);
    expect(await deliverCallback(ctx, callback)).toBe(
      `/factories/proj-1/settings/mcp-servers?mcpServer=${server.id}&oauth=connected`,
    );

    // Every member sees it connected, with its tools selected.
    expect(await getServer(ctx, server.id, member)).toMatchObject({
      status: 'connected',
      lastError: null,
      oauth: { connected: true },
      tools: [
        expect.objectContaining({ name: 'add', selected: true }),
        expect.objectContaining({ name: 'echo', selected: true }),
      ],
    });
    expect(ctx.authorizationServer.grants).toEqual(['authorization_code']);
    expect(ctx.authorizationServer.registrationAttempts).toBe(0);
    // The authorization server's host is now one the server's connections may reach.
    expect((await ctx.storage.get({ orgId: 'org-a', id: server.id }))?.authorizationServerHosts).toEqual([
      ctx.authorizationServer.host,
    ]);

    // Sessions call the server with the organization's tokens.
    const { tools } = await ctx.runtime.toolsFor({ orgId: 'org-a', existingNames: new Set() });
    expect(await tools.orders_add!.execute!({ a: 2, b: 3 }, {} as never)).toMatchObject({
      isError: false,
      content: [{ type: 'text', text: '{"sum":5}' }],
    });
    expect(ctx.mcp.calls).toEqual([{ tool: 'add', args: { a: 2, b: 3 } }]);
  });

  it('finishes a sign-in on another replica that shares only the database and the state secret', async () => {
    const url = `file:${join(mkdtempSync(join(tmpdir(), 'factory-mcp-oauth-')), 'replicas.db')}`;
    const encryption = createFactorySecretEncryption({ primary: { id: 'v1', key: new Uint8Array(32).fill(4) } });
    const openStorage = async (id: string) => {
      const backend = new LibSQLFactoryStorage({ id, url });
      const storage = backend.registerDomain(new McpServersStorage(encryption));
      await backend.init();
      onTestFinished(() => backend.close());
      return { backend, storage };
    };
    const a = await openStorage('replica-a');
    const replicaA = replica(a.storage, { publicOrigin: HTTPS_ORIGIN });
    const replicaB = replica((await openStorage('replica-b')).storage, { publicOrigin: HTTPS_ORIGIN });
    const authorizationServer = await startTestAuthorizationServer();
    const mcp = await startTestMcpServer({ authorizationServer });

    // No client ID: the Factory identifies itself with its Client ID Metadata Document.
    const server = await addOAuthServer(replicaA, mcp, {});
    const authorizationUrl = await startSignIn(replicaA, server.id);
    const metadataUrl = `${HTTPS_ORIGIN}/.well-known/oauth-client/mastra-factory.json`;
    expect(authorizationUrl.searchParams.get('client_id')).toBe(metadataUrl);

    expect(await deliverCallback(replicaB, await authorize(authorizationUrl))).toBe(
      `/factories/proj-1/settings/mcp-servers?mcpServer=${server.id}&oauth=connected`,
    );
    expect(await getServer(replicaA, server.id)).toMatchObject({ status: 'connected', oauth: { connected: true } });
    expect(authorizationServer.authorizeClientIds).toEqual([metadataUrl]);
    expect(authorizationServer.registrationAttempts).toBe(0);

    // The organization's tokens are at rest only as ciphertext.
    const rows = await a.backend.ops.findMany<{ key: string; value: string }>('mcp_server_oauth', {
      server_id: server.id,
    });
    expect(rows.map(row => row.key)).toContain('tokens');
    for (const row of rows) expect(row.value).toMatch(/^mastra:factory-secret:v1:/);
    for (const token of [...authorizationServer.validTokens, ...authorizationServer.refreshTokens]) {
      expect(JSON.stringify(rows)).not.toContain(token);
    }

    const document = await replicaB.request(null, 'GET', '/.well-known/oauth-client/mastra-factory.json');
    expect(await document.json()).toEqual({
      client_id: metadataUrl,
      client_name: 'Mastra Factory',
      redirect_uris: [`${HTTPS_ORIGIN}/auth/mcp-servers/callback`],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
    });
  });

  it('rejects a tampered state, a callback from another user or organization, and a signed-out browser', async () => {
    const ctx = await setup();
    const server = await addOAuthServer(ctx, ctx.mcp);
    const callback = await authorize(await startSignIn(ctx, server.id));

    const tampered = new URL(callback);
    tampered.searchParams.set('state', `${callback.searchParams.get('state')}x`);
    expect(await deliverCallback(ctx, tampered)).toBe('/?oauth=error&reason=invalid_state');
    expect(await deliverCallback(ctx, callback, secondAdmin)).toBe('/?oauth=error&reason=invalid_state');
    expect(await deliverCallback(ctx, callback, otherOrgAdmin)).toBe('/?oauth=error&reason=invalid_state');
    expect(await deliverCallback(ctx, callback, null)).toBe(
      '/factories/proj-1/settings/mcp-servers?oauth=error&reason=signed_out',
    );
    expect(ctx.authorizationServer.grants).toEqual([]);

    // None of them used up the admin's sign-in.
    expect(await deliverCallback(ctx, callback)).toContain('oauth=connected');
  });

  it('uses a callback once', async () => {
    const ctx = await setup();
    const server = await addOAuthServer(ctx, ctx.mcp);
    const callback = await authorize(await startSignIn(ctx, server.id));

    expect(await deliverCallback(ctx, callback)).toContain('oauth=connected');
    expect(await deliverCallback(ctx, callback)).toBe(
      '/factories/proj-1/settings/mcp-servers?oauth=error&reason=expired',
    );
    expect(ctx.authorizationServer.grants).toEqual(['authorization_code']);
  });

  it('does not finish a sign-in left open for more than ten minutes', async () => {
    const ctx = await setup();
    const server = await addOAuthServer(ctx, ctx.mcp);
    const callback = await authorize(await startSignIn(ctx, server.id));

    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.now() + 11 * 60 * 1000);
    expect(await deliverCallback(ctx, callback)).toContain('oauth=error');
    vi.useRealTimers();

    expect(ctx.authorizationServer.grants).toEqual([]);
    expect(await getServer(ctx, server.id)).toMatchObject({ oauth: { connected: false } });
  });

  it('does not finish a sign-in for an admin who lost admin rights, or for a server whose address changed', async () => {
    const ctx = await setup();
    const server = await addOAuthServer(ctx, ctx.mcp);
    const demoted = await authorize(await startSignIn(ctx, server.id));
    ctx.admins.delete('admin-a');
    expect(await deliverCallback(ctx, demoted)).toBe(
      `/factories/proj-1/settings/mcp-servers?mcpServer=${server.id}&oauth=error&reason=forbidden`,
    );
    ctx.admins.add('admin-a');

    const moved = await authorize(await startSignIn(ctx, server.id));
    const other = await startTestMcpServer({ authorizationServer: ctx.authorizationServer });
    const patch = await ctx.request(admin, 'PATCH', `/web/config/mcp-servers/${server.id}`, {
      url: other.url,
      oauth: { clientSecret: CLIENT_SECRET },
    });
    expect(patch.status).toBe(200);
    expect(await deliverCallback(ctx, moved)).toBe('/factories/proj-1/settings/mcp-servers?oauth=error&reason=expired');

    expect(ctx.authorizationServer.grants).toEqual([]);
    expect(await getServer(ctx, server.id)).toMatchObject({ oauth: { connected: false } });
  });

  it('reports a denied consent and an authorization response from the wrong issuer without exchanging a code', async () => {
    const ctx = await setup();
    const server = await addOAuthServer(ctx, ctx.mcp);
    const at = `/factories/proj-1/settings/mcp-servers?mcpServer=${server.id}`;

    ctx.authorizationServer.deny = true;
    expect(await deliverCallback(ctx, await authorize(await startSignIn(ctx, server.id)))).toBe(
      `${at}&oauth=error&reason=denied`,
    );
    ctx.authorizationServer.deny = false;

    // RFC 9207: a code that came back through some other authorization server is never redeemed.
    ctx.authorizationServer.responseIssuer = 'https://attacker.example';
    expect(await deliverCallback(ctx, await authorize(await startSignIn(ctx, server.id)))).toBe(
      `${at}&oauth=error&reason=failed`,
    );

    expect(ctx.authorizationServer.grants).toEqual([]);
    expect(await getServer(ctx, server.id)).toMatchObject({ oauth: { connected: false } });
  });

  it("keeps a failed code exchange's response, which can echo the PKCE verifier, out of the logs", async () => {
    const ctx = await setup();
    const server = await addOAuthServer(ctx, ctx.mcp);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    ctx.authorizationServer.echoTokenRequests = 'text';
    expect(await deliverCallback(ctx, await authorize(await startSignIn(ctx, server.id)))).toBe(
      `/factories/proj-1/settings/mcp-servers?mcpServer=${server.id}&oauth=error&reason=failed`,
    );

    const logged = [...warn.mock.calls, ...error.mock.calls].map(args => args.join(' ')).join('\n');
    expect(logged).toContain(
      'MCP server OAuth sign-in for "orders" failed: Sign-in failed: The authorization server failed or is busy. Try again later.',
    );
    expect(logged).not.toMatch(/code_verifier|upstream rejected/);
    expect(logged).not.toContain(CLIENT_SECRET);
    expect(await getServer(ctx, server.id)).toMatchObject({ oauth: { connected: false } });
  });

  it('only lets admins start a sign-in, and only for OAuth servers that can identify the Factory', async () => {
    const ctx = await setup();
    const server = await addOAuthServer(ctx, ctx.mcp);
    const start = (id: string, user = admin, body: unknown = {}) =>
      ctx.request(user, 'POST', `/web/config/mcp-servers/${id}/oauth/start`, body);

    expect((await start(server.id, member)).status).toBe(403);
    expect((await start(server.id, otherOrgAdmin)).status).toBe(404);
    expect((await start(server.id, admin, { factoryProjectId: '../../evil' })).status).toBe(400);

    const headers = await ctx.request(admin, 'POST', '/web/config/mcp-servers', {
      name: 'Docs',
      url: ctx.mcp.url,
      authType: 'headers',
      headers: [{ name: 'Authorization', value: 'Bearer x-token' }],
    });
    const headersServer = ((await headers.json()) as { server: McpServerInfo }).server;
    expect(await (await start(headersServer.id)).json()).toMatchObject({ error: 'mcp_server_not_oauth' });

    // Over plain http the Factory has no metadata document, so it needs a registered client ID.
    const noClient = await addOAuthServer(ctx, ctx.mcp, {}, 'Billing');
    const refused = await start(noClient.id);
    expect(refused.status).toBe(400);
    expect(await refused.json()).toMatchObject({ error: 'mcp_oauth_client_required' });

    // Nor does it serve one.
    expect((await ctx.request(null, 'GET', '/.well-known/oauth-client/mastra-factory.json')).status).toBe(404);

    const unsigned = replica(ctx.storage, { withStateSigner: false });
    expect((await unsigned.request(admin, 'POST', `/web/config/mcp-servers/${server.id}/oauth/start`, {})).status).toBe(
      503,
    );
    expect(ctx.authorizationServer.authorizeClientIds).toEqual([]);
  });
});

describe('MCP server OAuth tokens in sessions', () => {
  async function signedIn() {
    const ctx = await setup();
    const server = await addOAuthServer(ctx, ctx.mcp);
    expect(await deliverCallback(ctx, await authorize(await startSignIn(ctx, server.id)))).toContain('oauth=connected');
    return { ...ctx, server };
  }

  async function revokeAccessTokens(authorizationServer: TestAuthorizationServer) {
    authorizationServer.validTokens.clear();
  }

  it('refreshes an access token the server stopped accepting', async () => {
    const ctx = await signedIn();
    await revokeAccessTokens(ctx.authorizationServer);

    const { tools } = await ctx.runtime.toolsFor({ orgId: 'org-a', existingNames: new Set() });
    expect(await tools.orders_echo!.execute!({ text: 'still here' }, {} as never)).toMatchObject({
      isError: false,
      content: [{ type: 'text', text: '{"text":"still here"}' }],
    });
    expect(ctx.mcp.calls).toEqual([{ tool: 'echo', args: { text: 'still here' } }]);
    expect(ctx.authorizationServer.grants).toEqual(['authorization_code', 'refresh_token']);
    expect(await getServer(ctx, ctx.server.id)).toMatchObject({ status: 'connected', oauth: { connected: true } });
  });

  it('asks for sign-in again once the tokens are revoked, and stops giving sessions the tools', async () => {
    const ctx = await signedIn();
    await revokeAccessTokens(ctx.authorizationServer);
    ctx.authorizationServer.refreshTokens.clear();

    const { tools } = await ctx.runtime.toolsFor({ orgId: 'org-a', existingNames: new Set() });
    await expect(tools.orders_echo!.execute!({ text: 'refused' }, {} as never)).rejects.toThrow();
    expect(ctx.mcp.calls).toEqual([]);
    expect(await getServer(ctx, ctx.server.id)).toMatchObject({
      status: 'needs_auth',
      lastError: 'Sign in to connect this server.',
    });
    expect((await ctx.runtime.toolsFor({ orgId: 'org-a', existingNames: new Set() })).tools).toEqual({});
  });

  it("keeps a refused token refresh's description, which can echo the refresh token, out of sessions and statuses", async () => {
    const ctx = await signedIn();
    const [refreshToken] = ctx.authorizationServer.refreshTokens;
    await revokeAccessTokens(ctx.authorizationServer);
    ctx.authorizationServer.echoTokenRequests = 'oauth';
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const { tools } = await ctx.runtime.toolsFor({ orgId: 'org-a', existingNames: new Set() });
    const failure = await tools.orders_echo!.execute!({ text: 'refused' }, {} as never).catch(
      (error: unknown) => error,
    );
    expect((failure as Error).message).toBe(
      'MCP server "Orders" sign-in failed: The authorization server rejected the request (invalid_request).',
    );
    expect(ctx.mcp.calls).toEqual([]);

    const discover = await ctx.request(admin, 'POST', `/web/config/mcp-servers/${ctx.server.id}/discover`);
    const { server } = (await discover.json()) as { server: McpServerInfo };
    expect(server).toMatchObject({
      status: 'error',
      lastError: 'The authorization server rejected the request (invalid_request).',
    });
    expect(JSON.stringify(server)).not.toContain(refreshToken!);
    const logged = [...warn.mock.calls, ...error.mock.calls].map(args => args.join(' ')).join('\n');
    expect(logged).not.toContain(refreshToken!);
  });

  it('signs the server out for the whole organization', async () => {
    const ctx = await signedIn();

    expect((await ctx.request(member, 'DELETE', `/web/config/mcp-servers/${ctx.server.id}/oauth`)).status).toBe(403);
    const response = await ctx.request(admin, 'DELETE', `/web/config/mcp-servers/${ctx.server.id}/oauth`);
    expect(response.status).toBe(200);
    expect(((await response.json()) as { server: McpServerInfo }).server).toMatchObject({
      status: 'needs_auth',
      oauth: { connected: false },
    });
    expect((await ctx.storage.get({ orgId: 'org-a', id: ctx.server.id }))?.authorizationServerHosts).toEqual([]);
    expect((await ctx.runtime.toolsFor({ orgId: 'org-a', existingNames: new Set() })).tools).toEqual({});

    // Connecting again does not quietly reuse anything.
    const discover = await ctx.request(admin, 'POST', `/web/config/mcp-servers/${ctx.server.id}/discover`);
    expect(((await discover.json()) as { server: McpServerInfo }).server).toMatchObject({ status: 'needs_auth' });
    expect(ctx.authorizationServer.grants).toEqual(['authorization_code']);
  });
});
