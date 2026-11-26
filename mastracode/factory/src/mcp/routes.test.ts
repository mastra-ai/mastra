import { createServer } from 'node:http';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { MCPClient } from '@mastra/mcp';
import { Hono } from 'hono';
import type { Context } from 'hono';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import type { CryptoKey, JWTPayload } from 'jose';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DispatcherBoardEngine } from '../board-engine/engine.js';
import { createBoardRegistry } from '../boards/index.js';
import { PLATFORM_AUTH_PROVIDER } from '../platform-auth-host.js';
import type { RouteAuth } from '../routes/route.js';
import { FactoryTransitionService } from '../rules/transition-service.js';
import { createSourceControlSessionLookup } from '../session/factory-session.js';
import { AuditDomain } from '../storage/domains/audit/domain.js';
import { createFactoryStorageForTests } from '../storage/test-utils.js';
import type { FactoryToolDependencies } from '../tools/index.js';
import { createWorkosMcpCallerResolver } from './caller.js';
import type { McpCallerResolver } from './caller.js';
import { ACTIVITY_SETTLE_MS } from './events.js';
import {
  buildFactoryMcpRoutes,
  connectorSessionId,
  factoryMcpResource,
  PLATFORM_MCP_AUTHORIZATION_SERVER,
  resolveMcpAuthorizationServers,
} from './routes.js';
import { createMcpTokenVerifier } from './token.js';

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

const RESOURCE = factoryMcpResource(PUBLIC_ORIGIN);

/** Who each test token was issued to; tests name tokens, `bearer()` turns them into signed JWTs. */
const USERS: Record<string, { orgId?: string; userId: string }> = {
  'token-alice': { orgId: 'org-1', userId: 'alice' },
  'token-bob': { orgId: 'org-1', userId: 'bob' },
  'token-mallory': { orgId: 'org-2', userId: 'mallory' },
  'token-no-org': { userId: 'drifter' },
};

/**
 * An OAuth authorization server over real HTTP: RFC 8414 metadata and a JWKS,
 * signing RS256 access tokens the way AuthKit does with Resource Indicators on.
 * `outage` makes either endpoint answer 503, or never answer; `discovery`
 * picks which well-known document describes the server. `path` gives the
 * issuer a path, as multi-tenant servers do: RFC 8414 metadata then lives at
 * `/.well-known/oauth-authorization-server<path>`, OpenID Connect discovery
 * at `<path>/.well-known/openid-configuration`.
 */
async function startAuthorizationServer({ path = '' }: { path?: string } = {}) {
  const signingKey = async (kid: string) => {
    const { publicKey, privateKey } = await generateKeyPair('RS256');
    return { kid, privateKey, jwk: { ...(await exportJWK(publicKey)), kid, alg: 'RS256', use: 'sig' } };
  };
  let key = await signingKey('key-1');
  let jwksPath = `${path}/oauth2/jwks`;
  let issuer = '';
  const outage: { metadata: false | 'down' | 'hang'; jwks: false | 'down' | 'hang' | 'malformed' } = {
    metadata: false,
    jwks: false,
  };
  const hanging: Array<() => void> = [];
  const discovery: { kind: 'oauth' | 'openid'; issuer?: string } = { kind: 'oauth' };
  /** How long metadata takes to answer, and how often it has been read. */
  const metadata = { delayMs: 0, reads: 0 };
  hangingResponses.push(() => hanging.splice(0).forEach(end => end()));
  const server = createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    const document =
      discovery.kind === 'oauth'
        ? `/.well-known/oauth-authorization-server${path}`
        : `${path}/.well-known/openid-configuration`;
    if (req.url === document) {
      metadata.reads++;
      if (outage.metadata === 'hang') hanging.push(() => res.end());
      else if (outage.metadata) res.writeHead(503).end('{}');
      else {
        const body = JSON.stringify({ issuer: discovery.issuer ?? issuer, jwks_uri: `${origin}${jwksPath}` });
        setTimeout(() => res.end(body), metadata.delayMs);
      }
    } else if (req.url === jwksPath) {
      if (outage.jwks === 'hang') hanging.push(() => res.end());
      else if (outage.jwks === 'malformed') res.end('{}');
      else if (outage.jwks) res.writeHead(503).end('{}');
      else res.end(JSON.stringify({ keys: [key.jwk] }));
    } else {
      res.writeHead(404).end('{}');
    }
  });
  servers.push(server);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  issuer = `${origin}${path}`;
  return {
    issuer,
    outage,
    discovery,
    metadata,
    /** Sign with a new key published at a new JWKS URL, retiring the old URL. */
    rotateKeys: async (newJwksPath: string) => {
      key = await signingKey(`key-${Date.now()}`);
      jwksPath = newJwksPath;
    },
    sign: (claims: JWTPayload, options: SignOptions = {}) => sign(key.privateKey, key.kid, issuer, claims, options),
  };
}

interface SignOptions {
  issuer?: string;
  audience?: string | string[] | null;
  expiresIn?: string;
}

function sign(key: CryptoKey, kid: string, issuer: string, claims: JWTPayload, options: SignOptions): Promise<string> {
  const jwt = new SignJWT(claims)
    .setProtectedHeader({ alg: 'RS256', kid })
    .setIssuer(options.issuer ?? issuer)
    .setIssuedAt()
    .setExpirationTime(options.expiresIn ?? '1h');
  const audience = options.audience === undefined ? RESOURCE : options.audience;
  if (audience !== null) jwt.setAudience(audience);
  return jwt.sign(key);
}

/** Signed tokens for the `USERS` names, filled per test by `setup()`. */
const signedTokens = new Map<string, string>();
const bearer = (token: string) => signedTokens.get(token) ?? token;

async function setup(
  options: {
    resolveCaller?: McpCallerResolver;
    timeoutMs?: number;
    issuerPath?: string;
    metadataMaxAgeMs?: number;
    organizationId?: string;
  } = {},
) {
  const seed = await createFactoryStorageForTests();
  const authServer = await startAuthorizationServer({ path: options.issuerPath });
  for (const [name, user] of Object.entries(USERS)) {
    signedTokens.set(name, await authServer.sign({ sub: user.userId, ...(user.orgId ? { org_id: user.orgId } : {}) }));
  }
  // The MCP endpoint checks its own tokens; the audit domain's route auth is never consulted here.
  const auth: RouteAuth = {
    enabled: () => true,
    ensureUser: async () => undefined,
    tenant: () => undefined,
    isOrganizationAdmin: async () => false,
  };
  const boards = createBoardRegistry();
  const sourceControl = seed.sourceControl.forIntegration('github');
  const auditDomain = new AuditDomain({ auth, audit: seed.audit, projects: seed.projects });
  const tools: FactoryToolDependencies = {
    workItems: seed.workItems,
    audit: seed.audit,
    boards,
    boardEngine: new DispatcherBoardEngine({
      workItems: seed.workItems,
      boards,
      transitionService: new FactoryTransitionService({
        configVersion: 'mcp-test',
        boards,
        storage: seed.workItems,
        audit: auditDomain,
      }),
    }),
    auditRecorder: auditDomain,
    sessions: createSourceControlSessionLookup([sourceControl]),
    sessionModel: { projects: seed.projects, modelDefaults: seed.modelDefaults },
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
    verifyAccessToken: createMcpTokenVerifier({
      authorizationServers: [authServer.issuer],
      resource: RESOURCE,
      ...(options.resolveCaller ? { resolveCaller: options.resolveCaller } : {}),
      ...(options.timeoutMs ? { timeoutMs: options.timeoutMs } : {}),
      ...(options.metadataMaxAgeMs ? { metadataMaxAgeMs: options.metadataMaxAgeMs } : {}),
    }),
    publicOrigin: PUBLIC_ORIGIN,
    authorizationServers: [authServer.issuer],
    ...(options.organizationId ? { organizationId: options.organizationId } : {}),
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
  /** Link a repository and file sessions under it, the way starting a session does. */
  const createSessions = async (
    sessions: Array<{ sessionId: string; userId: string; visibility: 'org' | 'private'; title?: string }>,
  ) => {
    const installation = await sourceControl.installations.upsert({
      orgId: 'org-1',
      connectedByUserId: 'alice',
      externalId: '1',
    });
    const repository = await sourceControl.repositories.upsert({
      orgId: 'org-1',
      input: { installationId: installation.id, externalId: '2', slug: 'acme/app', defaultBranch: 'main' },
    });
    const connection = await sourceControl.connections.create({
      orgId: 'org-1',
      factoryProjectId: project.id,
      installationId: installation.id,
      createdByUserId: 'alice',
    });
    const link = await sourceControl.projectRepositories.link({
      orgId: 'org-1',
      connectionId: connection.id,
      repositoryId: repository.id,
    });
    for (const session of sessions) {
      await sourceControl.sessions.create({
        ...session,
        projectRepositoryId: link.id,
        factoryProjectId: project.id,
        orgId: 'org-1',
        branch: `user/${session.sessionId}`,
        baseBranch: 'main',
      });
    }
  };
  return { ...seed, project, item, base, authServer, url: mcpUrl(base), createSessions };
}

const servers: Server[] = [];
const clients: MCPClient[] = [];
/** Ends responses a hanging authorization server is holding open, so its server can close. */
const hangingResponses: Array<() => void> = [];
afterEach(async () => {
  hangingResponses.splice(0).forEach(end => end());
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
      factory: { url: new URL(url), requestInit: { headers: { Authorization: `Bearer ${bearer(token)}` } } },
    },
  });
  clients.push(mcp);
  return mcp;
}

const mcpUrl = (base: string) => `${base}/mcp`;

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
      ...(token ? { Authorization: `Bearer ${bearer(token)}` } : {}),
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
  const contentType = response.headers.get('Content-Type') ?? '';
  if (!text || !/json|event-stream/.test(contentType)) return null;
  if (!contentType.includes('text/event-stream')) return JSON.parse(text);
  const messages = text
    .split('\n')
    .filter(line => line.startsWith('data:'))
    .map(line => JSON.parse(line.slice('data:'.length)));
  return messages.find(message => 'result' in message || 'error' in message) ?? null;
}

function toolText(result: { content: Array<{ type: string; text: string }> }): any {
  return JSON.parse(result.content.find(part => part.type === 'text')!.text);
}

/**
 * WorkOS user management as the resolver calls it: users by id, and each
 * user's active memberships. `members` is mutable so a test can remove someone,
 * and `down` makes users or memberships lookups fail with a 500.
 */
function workosDirectory(members: Record<string, string[]>, down = { users: false, memberships: false }) {
  const people: Record<string, { firstName: string; lastName: string; email: string }> = {
    alice: { firstName: 'Alice', lastName: 'Liddell', email: 'alice@example.com' },
    bob: { firstName: 'Bob', lastName: 'Builder', email: 'bob@example.com' },
  };
  const userManagement = {
    getUser: async (userId: string) => {
      if (down.users) throw Object.assign(new Error('Internal Server Error'), { status: 500 });
      const person = people[userId];
      if (!person) throw Object.assign(new Error('User not found'), { status: 404 });
      return { id: userId, profilePictureUrl: null, ...person };
    },
    listOrganizationMemberships: async ({ userId, organizationId }: { userId: string; organizationId: string }) => {
      if (down.memberships) throw Object.assign(new Error('Internal Server Error'), { status: 500 });
      return {
        data: (members[userId] ?? [])
          .filter(orgId => orgId === organizationId)
          .map(orgId => ({ organizationId: orgId })),
      };
    },
  };
  return createWorkosMcpCallerResolver(
    userManagement as unknown as Parameters<typeof createWorkosMcpCallerResolver>[0],
  );
}

describe('Factory MCP server', () => {
  it('Claude’s connector is sent to sign in for this endpoint', async () => {
    const { base, url, authServer } = await setup();

    const response = await claudeRequest(url, 'server/discover');

    expect(response.status).toBe(401);
    const challenge = response.headers.get('WWW-Authenticate') ?? '';
    const metadataUrl = /resource_metadata="([^"]+)"/.exec(challenge)?.[1];
    expect(metadataUrl).toBe(`${PUBLIC_ORIGIN}/.well-known/oauth-protected-resource/mcp`);

    // The connector follows the pointer; this server answers it under its local address.
    // `resource` is what the connector asks the authorization server to bind its token to.
    const metadata = await fetch(`${base}${new URL(metadataUrl!).pathname}`);
    expect(metadata.status).toBe(200);
    expect(await metadata.json()).toEqual({
      resource: `${PUBLIC_ORIGIN}/mcp`,
      authorization_servers: [authServer.issuer],
      bearer_methods_supported: ['header'],
      resource_name: 'Mastra Factory',
    });
  });

  it('refuses tokens not issued for this endpoint', async () => {
    const { url, authServer } = await setup();
    const claims = { sub: 'alice', org_id: 'org-1' };
    const refused = {
      // A Platform login: no audience, valid everywhere Platform accepts a login.
      'Platform login': await authServer.sign(claims, { audience: null }),
      // Issued for Platform's own MCP server.
      'Platform MCP token': await authServer.sign(claims, { audience: 'https://platform.mastra.ai/v1/mcp' }),
      // Issued for another Factory.
      'other Factory token': await authServer.sign(claims, { audience: 'https://other.factory.mastra.cloud/mcp' }),
      // Signed with this server's key but naming an issuer the Factory doesn't trust.
      'unknown issuer': await authServer.sign(claims, { issuer: 'https://attacker.example.com' }),
      expired: await authServer.sign(claims, { expiresIn: '-1m' }),
      'not a JWT': 'token-alice-but-opaque',
      // Also issued for another resource, so it isn't for this endpoint alone.
      'token for this and another resource': await authServer.sign(claims, {
        audience: [RESOURCE, 'https://platform.mastra.ai/v1/mcp'],
      }),
      'empty subject': await authServer.sign({ ...claims, sub: '' }),
      'non-string subject': await authServer.sign({ ...claims, sub: 42 as unknown as string }),
    };
    // A key the authorization server never published, under its issuer.
    const stranger = await startAuthorizationServer();
    const forged = await stranger.sign(claims, { issuer: authServer.issuer });

    for (const [label, token] of Object.entries({ ...refused, 'forged signature': forged })) {
      const response = await claudeRequest(url, 'tools/list', {}, token);
      expect(response.status, label).toBe(401);
      expect(response.headers.get('WWW-Authenticate'), label).toContain('error="invalid_token"');
    }

    const accepted = await claudeRequest(url, 'tools/list', {}, await authServer.sign(claims));
    expect(accepted.status).toBe(200);
  });

  it("serves an organization's first project when it has created others since", async () => {
    const { url, projects } = await setup();
    const second = await projects.create({ orgId: 'org-1', userId: 'alice', input: { name: 'Second' } });
    // The newest-updated project would come first if the endpoint went by list order.
    await projects.update({ orgId: 'org-1', id: second.id, input: { name: 'Second, renamed' } });

    const response = await claudeRequest(
      url,
      'tools/call',
      { name: 'search', arguments: { query: 'login' } },
      'token-alice',
    );

    expect(response.status).toBe(200);
    expect(toolText(response.body!.result).results).toEqual([expect.objectContaining({ title: 'Fix the login page' })]);
  });

  it('someone removed from the organization loses access at once, though their token has not expired', async () => {
    const members: Record<string, string[]> = { alice: ['org-1'] };
    const { url } = await setup({ resolveCaller: workosDirectory(members) });

    expect((await claudeRequest(url, 'server/discover', {}, 'token-alice')).status).toBe(200);

    members.alice = [];
    const response = await claudeRequest(url, 'server/discover', {}, 'token-alice');
    expect(response.status).toBe(401);
    expect(response.headers.get('WWW-Authenticate')).toContain('error="invalid_token"');
  });

  it('finds the metadata of an authorization server whose issuer has a path', async () => {
    const { url } = await setup({ issuerPath: '/tenant' });
    expect((await claudeRequest(url, 'server/discover', {}, 'token-alice')).status).toBe(200);

    const openid = await setup({ issuerPath: '/tenant' });
    openid.authServer.discovery.kind = 'openid';
    expect((await claudeRequest(openid.url, 'server/discover', {}, 'token-alice')).status).toBe(200);
  });

  it('refuses to trust keys from metadata that describes another issuer', async () => {
    const { url, authServer } = await setup();
    authServer.discovery.issuer = 'https://attacker.example.com';

    expect((await claudeRequest(url, 'server/discover', {}, 'token-alice')).status).toBe(500);
  });

  it('follows an authorization server that moves its signing keys to a new URL', async () => {
    const { url, authServer } = await setup({ metadataMaxAgeMs: 100 });
    expect((await claudeRequest(url, 'server/discover', {}, 'token-alice')).status).toBe(200);

    await authServer.rotateKeys('/oauth2/jwks-2026');
    const token = await authServer.sign({ sub: 'alice', org_id: 'org-1' });
    // Once the metadata is read again, the Factory finds the new key at the new URL.
    await new Promise(resolve => setTimeout(resolve, 150));
    expect((await claudeRequest(url, 'server/discover', {}, token)).status).toBe(200);
  });

  it('a deployment pinned to one organization refuses tokens for another', async () => {
    const { url, projects } = await setup({ organizationId: 'org-1' });
    // Someone in the pinned org created a project under their other org.
    await projects.create({ orgId: 'org-2', userId: 'alice', input: { name: 'Globex' } });

    const outsider = await claudeRequest(url, 'server/discover', {}, 'token-mallory');
    expect(outsider.status).toBe(403);
    expect(outsider.body).toEqual({ error: 'organization_forbidden' });
    expect((await claudeRequest(url, 'server/discover', {}, 'token-alice')).status).toBe(200);
  });

  it('requests arriving during a slow metadata lookup share it', async () => {
    const { url, authServer } = await setup({ metadataMaxAgeMs: 100 });
    authServer.metadata.delayMs = 300;

    const first = claudeRequest(url, 'server/discover', {}, 'token-alice');
    // Arrives after the cache lifetime has passed, but before the lookup answers.
    await new Promise(resolve => setTimeout(resolve, 150));
    const second = claudeRequest(url, 'server/discover', {}, 'token-bob');

    expect((await first).status).toBe(200);
    expect((await second).status).toBe(200);
    expect(authServer.metadata.reads).toBe(1);
  });

  it('accepts tokens from an authorization server that only publishes OpenID Connect discovery', async () => {
    const { url, authServer } = await setup();
    authServer.discovery.kind = 'openid';

    expect((await claudeRequest(url, 'server/discover', {}, 'token-alice')).status).toBe(200);
  });

  it('an authorization server outage is a server error, not a bad sign-in', async () => {
    const { url, authServer } = await setup();

    authServer.outage.metadata = 'down';
    const noMetadata = await claudeRequest(url, 'server/discover', {}, 'token-alice');
    expect(noMetadata.status).toBe(500);
    expect(noMetadata.headers.get('WWW-Authenticate')).toBeNull();

    authServer.outage.metadata = false;
    authServer.outage.jwks = 'down';
    const noKeys = await claudeRequest(url, 'server/discover', {}, 'token-alice');
    expect(noKeys.status).toBe(500);
    expect(noKeys.headers.get('WWW-Authenticate')).toBeNull();

    authServer.outage.jwks = 'malformed';
    const badKeys = await claudeRequest(url, 'server/discover', {}, 'token-alice');
    expect(badKeys.status).toBe(500);
    expect(badKeys.headers.get('WWW-Authenticate')).toBeNull();

    // Once it's back, the next request signs in: the failures weren't cached.
    authServer.outage.jwks = false;
    expect((await claudeRequest(url, 'server/discover', {}, 'token-alice')).status).toBe(200);
  });

  it('an authorization server that stops answering fails the request instead of holding it open', async () => {
    const { url, authServer } = await setup({ timeoutMs: 200 });

    authServer.outage.metadata = 'hang';
    expect((await claudeRequest(url, 'server/discover', {}, 'token-alice')).status).toBe(500);

    authServer.outage.metadata = false;
    authServer.outage.jwks = 'hang';
    expect((await claudeRequest(url, 'server/discover', {}, 'token-alice')).status).toBe(500);
  });

  it('a failed user or membership lookup is a server error, not access', async () => {
    const down = { users: true, memberships: false };
    const { url } = await setup({ resolveCaller: workosDirectory({ alice: ['org-1'] }, down) });

    const usersDown = await claudeRequest(url, 'server/discover', {}, 'token-alice');
    expect(usersDown.status).toBe(500);
    expect(usersDown.headers.get('WWW-Authenticate')).toBeNull();

    Object.assign(down, { users: false, memberships: true });
    const membershipsDown = await claudeRequest(url, 'server/discover', {}, 'token-alice');
    expect(membershipsDown.status).toBe(500);
    expect(membershipsDown.headers.get('WWW-Authenticate')).toBeNull();
    // An unknown user doesn't hide the outage, whichever lookup answers first.
    expect((await claudeRequest(url, 'server/discover', {}, 'token-mallory')).status).toBe(500);

    down.memberships = false;
    expect((await claudeRequest(url, 'server/discover', {}, 'token-alice')).status).toBe(200);
  });

  it('a user who no longer exists is refused', async () => {
    const { url } = await setup({ resolveCaller: workosDirectory({}) });
    // `mallory` isn't in the directory at all.
    expect((await claudeRequest(url, 'server/discover', {}, 'token-mallory')).status).toBe(401);
  });

  it('the audit trail names who made a change from Claude', async () => {
    const { url, item, project, audit } = await setup({ resolveCaller: workosDirectory({ alice: ['org-1'] }) });

    const call = await claudeRequest(
      url,
      'tools/call',
      { name: 'factory_update_work_item', arguments: { workItem: item.id, title: 'Fix the sign-in page' } },
      'token-alice',
    );
    expect(call.body?.result.isError).not.toBe(true);

    const { events } = await audit.list({
      orgId: 'org-1',
      factoryProjectId: project.id,
      actions: ['factory.work_item.updated'],
    });
    expect(events).toEqual([
      expect.objectContaining({
        actorId: 'alice',
        metadata: expect.objectContaining({ __actorProfile: { name: 'Alice Liddell' } }),
      }),
    ]);
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

  it('an older MCP client (VS Code, Cursor) signs in, lists and runs the tools', async () => {
    const { url, item, project } = await setup();

    // A 2025-era opening: `initialize`, no `_meta` envelope, no 2026 headers.
    const opening = (token?: string) =>
      fetch(url, {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${bearer(token)}` } : {}),
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'vscode', version: '1.0.0' } },
        }),
      });

    const anonymous = await opening();
    expect(anonymous.status).toBe(401);
    expect(anonymous.headers.get('www-authenticate')).toContain('resource_metadata=');

    const signedIn = await opening('token-alice');
    expect(signedIn.status).toBe(200);
    expect(signedIn.headers.has('mcp-session-id')).toBe(false);
    expect((await readJsonRpc(signedIn))?.result).toMatchObject({
      protocolVersion: '2025-11-25',
      serverInfo: { name: 'Acme Factory' },
    });

    const mcp = new MCPClient({
      id: `factory-mcp-legacy-${Math.random()}`,
      servers: {
        factory: {
          url: new URL(url),
          protocolVersion: 'legacy',
          requestInit: { headers: { Authorization: `Bearer ${bearer('token-alice')}` } },
        },
      },
    });
    clients.push(mcp);
    const tools = await mcp.listTools();
    expect(mcp.getServerProtocolVersions().factory).not.toBe(PROTOCOL_VERSION);
    expect(Object.keys(tools)).not.toContain('factory_factory_message_origin');
    const result = (await tools.factory_search!.execute!({ query: 'login' }, {} as never)) as {
      content: Array<{ type: string; text: string }>;
    };
    expect(toolText(result).results).toEqual([
      { id: item.id, title: 'Fix the login page', url: `${PUBLIC_ORIGIN}/factory/${project.id}/work-items/${item.id}` },
    ]);
  });

  it('finds no project for a user from an organization without a Factory project', async () => {
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
  // Polling only moves past events once they have settled, so these tests drive the clock.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });
  const tick = (ms: number) => vi.setSystemTime(Date.now() + ms);
  const settle = () => tick(ACTIVITY_SETTLE_MS + 1);

  const poll = (
    url: string,
    token: string,
    cursor: string | null | undefined,
    args: Record<string, unknown> = {},
    options: { maxAgeMs?: number } = {},
  ) =>
    claudeRequest(
      url,
      'events/poll',
      { name: 'factory.activity', arguments: args, ...(cursor === undefined ? {} : { cursor }), ...options },
      token,
    );

  const activity = (action: string) => ({ action, occurredAt: expect.any(String), actor: expect.any(Object) });

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

    tick(1000);
    const rename = await renameItem(url, item.id, 'Fix the sign-in page');
    expect(rename.body?.result.isError).not.toBe(true);

    settle();
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
    const { url, project, item, audit } = await setup();
    // Already on the trail: starting over from the start would replay it.
    await audit.record({
      orgId: 'org-1',
      actorId: 'alice',
      action: 'factory.work_item.created',
      targets: [{ type: 'work_item', id: item.id, name: item.title }],
      factoryProjectId: project.id,
    });

    // Well-formed, but its id isn't an audit row id (Postgres would reject it in the query).
    const restart = await poll(url, 'token-alice', '2026-10-21T00:00:00.000Z_row-7');
    expect(restart.status).toBe(200);
    expect(restart.body?.result).toMatchObject({ events: [], truncated: true, cursor: expect.any(String) });

    tick(1000);
    await renameItem(url, item.id, 'Fix the sign-in page');
    settle();
    const next = await poll(url, 'token-alice', restart.body!.result.cursor);
    expect(next.body?.result.events.map((event: any) => event.data.action)).toEqual(['factory.work_item.updated']);
  });

  it('an event written while a poll runs is still delivered on the next poll', async () => {
    const { url, project, item, audit } = await setup();
    const record = (action: string, occurredAt?: Date) =>
      audit.record({
        orgId: 'org-1',
        actorId: 'alice',
        action,
        targets: [{ type: 'work_item', id: item.id, name: item.title }],
        factoryProjectId: project.id,
        ...(occurredAt ? { occurredAt } : {}),
      });
    const start = await poll(url, 'token-alice', null);
    tick(1000);

    await record('factory.work_item.created');
    const during = await poll(url, 'token-alice', start.body!.result.cursor);
    expect(during.body?.result).toMatchObject({ events: [], cursor: start.body!.result.cursor });
    // Written in the same millisecond as that poll, or stamped just before it and committed after.
    await record('factory.work_item.updated');
    await record('factory.work_item.stage_moved', new Date(Date.now() - 10));

    settle();
    const next = await poll(url, 'token-alice', during.body!.result.cursor);
    expect(next.body?.result.events.map((event: any) => event.data.action).sort()).toEqual([
      'factory.work_item.created',
      'factory.work_item.stage_moved',
      'factory.work_item.updated',
    ]);
  });

  it('a client resuming an old cursor with maxAgeMs skips older events and is told it did', async () => {
    const { url, item } = await setup();
    const start = await poll(url, 'token-alice', null);
    tick(1000);
    await renameItem(url, item.id, 'Fix the sign-in page');

    tick(10 * 60_000);
    const resumed = await poll(url, 'token-alice', start.body!.result.cursor, {}, { maxAgeMs: 60_000 });
    expect(resumed.body?.result).toMatchObject({ events: [], truncated: true });
    expect(resumed.body!.result.cursor).not.toBe(start.body!.result.cursor);

    const after = await poll(url, 'token-alice', resumed.body!.result.cursor);
    expect(after.body?.result.events).toEqual([]);
  });

  it.each([
    { cursor: null, truncated: false },
    { cursor: undefined, truncated: false },
    { cursor: '', truncated: true },
    { cursor: 'not-a-cursor', truncated: true },
  ])('a client polling with cursor $cursor starts from now (truncated: $truncated)', async ({ cursor, truncated }) => {
    const { url, project, item, audit } = await setup();
    await audit.record({
      orgId: 'org-1',
      actorId: 'alice',
      action: 'factory.work_item.created',
      targets: [{ type: 'work_item', id: item.id, name: item.title }],
      factoryProjectId: project.id,
    });
    settle();

    const first = await poll(url, 'token-alice', cursor);
    expect(first.status).toBe(200);
    expect(first.body?.result.events).toEqual([]);
    expect(first.body?.result.truncated === true).toBe(truncated);

    settle();
    const next = await poll(url, 'token-alice', first.body!.result.cursor);
    expect(next.body?.result.events).toEqual([]);
  });

  it('activity from another org’s Factory never shows up', async () => {
    const { url, base, item, projects } = await setup();
    const globex = await projects.create({ orgId: 'org-2', userId: 'mallory', input: { name: 'Globex' } });
    const globexUrl = mcpUrl(base);

    const start = await poll(globexUrl, 'token-mallory', null);
    tick(1000);
    await renameItem(url, item.id, 'Fix the sign-in page');
    settle();
    const next = await poll(globexUrl, 'token-mallory', start.body!.result.cursor);
    expect(next.body?.result.events).toEqual([]);

    // Naming the other org's work item doesn't get her its activity either.
    const targeted = await poll(globexUrl, 'token-mallory', null, { workItemId: item.id });
    expect(targeted.body?.result).toBeUndefined();
    expect(targeted.body?.error).toMatchObject({ code: -32024 });
  });

  it('session activity reaches the members who can see the session, and work item activity in a private session reaches everyone without naming it', async () => {
    const { url, project, item, audit, createSessions } = await setup();
    await createSessions([
      { sessionId: 'alice-private', userId: 'alice', visibility: 'private', title: 'Alice’s spike' },
      { sessionId: 'bob-private', userId: 'bob', visibility: 'private', title: 'Bob’s spike' },
      { sessionId: 'shared', userId: 'bob', visibility: 'org', title: 'Pairing on login' },
    ]);
    const aliceStart = await poll(url, 'token-alice', null);
    const bobStart = await poll(url, 'token-bob', null);

    const record = async (event: Omit<Parameters<typeof audit.record>[0], 'orgId' | 'factoryProjectId'>) => {
      tick(1);
      await audit.record({ orgId: 'org-1', factoryProjectId: project.id, ...event });
    };
    const signal = (sessionId: string) =>
      record({
        actorId: 'agent:thread-x',
        actorType: 'agent',
        action: 'factory.agent.signaled',
        targets: [{ type: 'session', id: sessionId }],
      });
    await signal('bob-private');
    await signal('shared');
    await signal('ghost-session');
    // An agent's own git activity names no session; its thread is the session.
    await record({
      actorId: 'agent:alice-private',
      actorType: 'agent',
      action: 'factory.agent.push',
      targets: [{ type: 'worktree', id: '/sandbox/app' }],
    });
    // Work item activity inside Bob's private session: others see it, but not which session.
    await record({
      actorId: 'bob',
      actorType: 'human',
      action: 'factory.run.approved',
      targets: [
        { type: 'session', id: 'bob-private' },
        { type: 'work_item', id: item.id, name: item.title },
      ],
    });
    await record({
      actorId: 'agent:bob-private',
      actorType: 'agent',
      action: 'factory.work_item.stage_moved',
      targets: [{ type: 'work_item', id: item.id, name: item.title }],
    });
    // An agent whose thread isn't a session (or no longer is): the work item shows, the thread doesn't.
    await record({
      actorId: 'agent:gone-thread',
      actorType: 'agent',
      action: 'factory.work_item.labels_reconciled',
      targets: [{ type: 'work_item', id: item.id, name: item.title }],
    });
    tick(1);
    await renameItem(url, item.id, 'Fix the sign-in page');

    settle();
    const seen = async (token: string, cursor: string) =>
      (await poll(url, token, cursor)).body?.result.events.map(
        (event: { data: { action: string; sessionId?: string; workItemId?: string; summary: string } }) => event.data,
      );
    expect(await seen('token-alice', aliceStart.body!.result.cursor)).toEqual([
      { ...activity('factory.agent.signaled'), sessionId: 'shared', summary: 'agent signaled: Pairing on login' },
      { ...activity('factory.agent.push'), sessionId: 'alice-private', summary: 'agent push: Alice’s spike' },
      {
        ...activity('factory.run.approved'),
        workItemId: item.id,
        privateSession: true,
        summary: 'run approved: Fix the login page (in a private session)',
      },
      {
        ...activity('factory.work_item.stage_moved'),
        actor: { type: 'agent', id: 'agent' },
        workItemId: item.id,
        privateSession: true,
        summary: 'stage moved: Fix the login page (in a private session)',
      },
      {
        ...activity('factory.work_item.labels_reconciled'),
        actor: { type: 'agent', id: 'agent' },
        workItemId: item.id,
        summary: 'labels reconciled: Fix the login page',
      },
      { ...activity('factory.work_item.updated'), workItemId: item.id, summary: 'updated: Fix the sign-in page' },
    ]);
    expect(await seen('token-bob', bobStart.body!.result.cursor)).toEqual([
      { ...activity('factory.agent.signaled'), sessionId: 'bob-private', summary: 'agent signaled: Bob’s spike' },
      { ...activity('factory.agent.signaled'), sessionId: 'shared', summary: 'agent signaled: Pairing on login' },
      {
        ...activity('factory.run.approved'),
        sessionId: 'bob-private',
        workItemId: item.id,
        summary: 'run approved: Fix the login page',
      },
      {
        ...activity('factory.work_item.stage_moved'),
        actor: { type: 'agent', id: 'agent:bob-private' },
        sessionId: 'bob-private',
        workItemId: item.id,
        summary: 'stage moved: Fix the login page',
      },
      {
        ...activity('factory.work_item.labels_reconciled'),
        actor: { type: 'agent', id: 'agent' },
        workItemId: item.id,
        summary: 'labels reconciled: Fix the login page',
      },
      { ...activity('factory.work_item.updated'), workItemId: item.id, summary: 'updated: Fix the sign-in page' },
    ]);
  });
});
