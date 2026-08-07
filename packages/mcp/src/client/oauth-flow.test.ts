import { createHash, randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import type { IncomingMessage, Server as HttpServer, ServerResponse } from 'node:http';
import { describe, it, expect, afterEach } from 'vitest';

import { createOAuthMiddleware } from '../server/oauth-middleware.js';
import type { OAuthMiddlewareResult } from '../server/oauth-middleware.js';
import { MCPServer } from '../server/server.js';
import { MCPClient } from './configuration.js';
import { getCallbackUrlCandidates } from './oauth-callback-server.js';
import { MCPOAuthClientProvider, InMemoryOAuthStorage } from './oauth-provider.js';

// =============================================================================
// Fake OAuth authorization server
//
// Implements just enough of OAuth 2.1 for the MCP client's OAuth flow: RFC 8414
// metadata discovery, RFC 7591 dynamic client registration, the authorization
// code grant with PKCE (S256), and the refresh token grant. Tokens are opaque
// random strings shared with the protected MCP server via `validTokens`.
// =============================================================================

interface ClientRegistration {
  client_id: string;
  redirect_uris: string[];
}

interface FakeAuthorizationServer {
  url: string;
  /** Every dynamic client registration received, in order. */
  registrations: ClientRegistration[];
  /** The redirect_uri of every authorization request received, in order. */
  authorizeRedirectUris: string[];
  /** How many refresh_token grants the token endpoint served. */
  refreshGrantCount: number;
  /** Access tokens currently accepted by the protected MCP server. */
  validTokens: Set<string>;
  /** When true, the authorization endpoint denies with error=access_denied. */
  denyAuthorization: boolean;
  close(): Promise<void>;
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function sendJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

async function startFakeAuthorizationServer(port: number): Promise<FakeAuthorizationServer> {
  const url = `http://127.0.0.1:${port}`;
  const clientsById = new Map<string, ClientRegistration>();
  const pendingCodes = new Map<string, { codeChallenge: string; redirectUri: string }>();
  const refreshTokens = new Set<string>();

  const state: FakeAuthorizationServer = {
    url,
    registrations: [],
    authorizeRedirectUris: [],
    refreshGrantCount: 0,
    validTokens: new Set(),
    denyAuthorization: false,
    close: () =>
      new Promise<void>((resolve, reject) => {
        httpServer.close(error => (error ? reject(error) : resolve()));
      }),
  };

  const httpServer: HttpServer = createServer(async (req, res) => {
    const requestUrl = new URL(req.url ?? '', url);

    if (requestUrl.pathname === '/.well-known/oauth-authorization-server') {
      sendJson(res, 200, {
        issuer: url,
        authorization_endpoint: `${url}/authorize`,
        token_endpoint: `${url}/token`,
        registration_endpoint: `${url}/register`,
        response_types_supported: ['code'],
        grant_types_supported: ['authorization_code', 'refresh_token'],
        code_challenge_methods_supported: ['S256'],
        token_endpoint_auth_methods_supported: ['none'],
      });
      return;
    }

    if (requestUrl.pathname === '/register' && req.method === 'POST') {
      const metadata = JSON.parse(await readBody(req));
      const registration: ClientRegistration = {
        client_id: `client-${randomUUID()}`,
        redirect_uris: metadata.redirect_uris,
      };
      clientsById.set(registration.client_id, registration);
      state.registrations.push(registration);
      sendJson(res, 201, {
        ...metadata,
        client_id: registration.client_id,
        client_id_issued_at: Math.floor(Date.now() / 1000),
        token_endpoint_auth_method: 'none',
      });
      return;
    }

    if (requestUrl.pathname === '/authorize') {
      const clientId = requestUrl.searchParams.get('client_id') ?? '';
      const redirectUri = requestUrl.searchParams.get('redirect_uri') ?? '';
      const oauthState = requestUrl.searchParams.get('state') ?? '';
      const codeChallenge = requestUrl.searchParams.get('code_challenge') ?? '';

      const client = clientsById.get(clientId);
      if (!client || !client.redirect_uris.includes(redirectUri)) {
        sendJson(res, 400, { error: 'invalid_request', error_description: 'Unknown client or redirect_uri' });
        return;
      }

      state.authorizeRedirectUris.push(redirectUri);
      const location = new URL(redirectUri);
      if (state.denyAuthorization) {
        location.searchParams.set('error', 'access_denied');
      } else {
        const code = `code-${randomUUID()}`;
        pendingCodes.set(code, { codeChallenge, redirectUri });
        location.searchParams.set('code', code);
      }
      location.searchParams.set('state', oauthState);
      res.writeHead(302, { Location: location.toString() });
      res.end();
      return;
    }

    if (requestUrl.pathname === '/token' && req.method === 'POST') {
      const params = new URLSearchParams(await readBody(req));
      const grantType = params.get('grant_type');

      if (grantType === 'authorization_code') {
        const pending = pendingCodes.get(params.get('code') ?? '');
        const verifier = params.get('code_verifier') ?? '';
        const challenge = createHash('sha256').update(verifier).digest('base64url');
        if (!pending || pending.codeChallenge !== challenge) {
          sendJson(res, 400, { error: 'invalid_grant' });
          return;
        }
        pendingCodes.delete(params.get('code')!);
      } else if (grantType === 'refresh_token') {
        if (!refreshTokens.has(params.get('refresh_token') ?? '')) {
          sendJson(res, 400, { error: 'invalid_grant' });
          return;
        }
        state.refreshGrantCount += 1;
      } else {
        sendJson(res, 400, { error: 'unsupported_grant_type' });
        return;
      }

      const accessToken = `access-${randomUUID()}`;
      const refreshToken = `refresh-${randomUUID()}`;
      state.validTokens.add(accessToken);
      refreshTokens.add(refreshToken);
      sendJson(res, 200, {
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: 3600,
        refresh_token: refreshToken,
      });
      return;
    }

    sendJson(res, 404, { error: 'not_found' });
  });

  await new Promise<void>(resolve => httpServer.listen(port, '127.0.0.1', resolve));
  return state;
}

// =============================================================================
// OAuth-protected MCP server (resource server)
// =============================================================================

async function startProtectedMcpServer(
  port: number,
  authServer: FakeAuthorizationServer,
): Promise<{ url: string; close(): Promise<void> }> {
  const url = `http://127.0.0.1:${port}`;

  const mcpServer = new MCPServer({
    id: `oauth-flow-test-server-${port}`,
    name: 'OAuth Flow Test Server',
    version: '1.0.0',
    tools: {},
  });

  const oauthMiddleware = createOAuthMiddleware({
    oauth: {
      resource: `${url}/mcp`,
      authorizationServers: [authServer.url],
      validateToken: async token =>
        authServer.validTokens.has(token)
          ? { valid: true }
          : { valid: false, error: 'invalid_token', errorDescription: 'Token not recognized' },
    },
    mcpPath: '/mcp',
  });

  const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const requestUrl = new URL(req.url ?? '', url);
    const result: OAuthMiddlewareResult = await oauthMiddleware(req, res, requestUrl);
    if (!result.proceed) {
      return;
    }
    await mcpServer.startHTTP({ url: requestUrl, httpPath: '/mcp', req, res });
  });

  await new Promise<void>(resolve => httpServer.listen(port, '127.0.0.1', resolve));
  return {
    url,
    close: () =>
      new Promise<void>((resolve, reject) => {
        httpServer.close(error => (error ? reject(error) : resolve()));
      }),
  };
}

// =============================================================================
// Test harness
// =============================================================================

// Each test gets its own port block: reusing ports across tests would let
// undici's keep-alive pool hand a later test a stale socket to a restarted server.
let portCursor = 19100 + Math.floor(Math.random() * 2000);
function allocatePortBlock(): { authPort: number; mcpPort: number; secondMcpPort: number; callbackUrl: string } {
  const base = portCursor;
  portCursor += 20;
  return {
    authPort: base,
    mcpPort: base + 1,
    secondMcpPort: base + 2,
    callbackUrl: `http://127.0.0.1:${base + 3}/oauth/callback`,
  };
}

/**
 * Simulates the user's browser: follows the authorization URL to the fake
 * authorization server and delivers its redirect to the loopback callback.
 */
async function driveBrowser(authorizationUrl: URL): Promise<void> {
  const response = await fetch(authorizationUrl, { redirect: 'manual' });
  const location = response.headers.get('location');
  if (!location) {
    throw new Error(`Authorization endpoint did not redirect (status ${response.status})`);
  }
  await fetch(location);
}

function createProvider(options: {
  callbackUrl: string;
  storage?: InMemoryOAuthStorage;
  onRedirectToAuthorization?: (url: URL) => void | Promise<void>;
}): MCPOAuthClientProvider {
  return new MCPOAuthClientProvider({
    redirectUrl: options.callbackUrl,
    clientMetadata: {
      redirect_uris: [options.callbackUrl],
      client_name: 'OAuth Flow Test Client',
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
    },
    storage: options.storage,
    onRedirectToAuthorization: options.onRedirectToAuthorization,
  });
}

function createClient(serverUrl: string, provider: MCPOAuthClientProvider): MCPClient {
  return new MCPClient({
    id: `oauth-flow-test-${randomUUID()}`,
    servers: {
      fixture: {
        url: new URL(`${serverUrl}/mcp`),
        authProvider: provider,
      },
    },
  });
}

describe('MCPClient OAuth authorization flow', () => {
  const cleanups: Array<() => Promise<void>> = [];

  const setup = async () => {
    const ports = allocatePortBlock();
    const authServer = await startFakeAuthorizationServer(ports.authPort);
    const mcpServer = await startProtectedMcpServer(ports.mcpPort, authServer);
    cleanups.push(
      () => mcpServer.close(),
      () => authServer.close(),
    );
    return { authServer, mcpServer, ports, callbackUrl: ports.callbackUrl };
  };

  const track = (mcp: MCPClient) => {
    cleanups.push(() => mcp.disconnect());
    return mcp;
  };

  afterEach(async () => {
    while (cleanups.length) {
      await cleanups.pop()!().catch(() => {});
    }
  });

  it('marks the server as needs-auth when the connection is rejected with a 401', async () => {
    const { mcpServer, callbackUrl } = await setup();
    const authorizationUrls: URL[] = [];
    const provider = createProvider({
      callbackUrl,
      onRedirectToAuthorization: url => void authorizationUrls.push(url),
    });
    const mcp = track(createClient(mcpServer.url, provider));

    await expect(mcp.reconnectServer('fixture')).rejects.toThrow();

    expect(mcp.getServerAuthState('fixture')).toBe('needs-auth');
    // The SDK delivered the authorization URL through the provider.
    expect(authorizationUrls).toHaveLength(1);
  });

  it('authenticates end to end: registration, consent, code exchange, connect', async () => {
    const { authServer, mcpServer, callbackUrl } = await setup();
    const storage = new InMemoryOAuthStorage();
    const provider = createProvider({ callbackUrl, storage, onRedirectToAuthorization: driveBrowser });
    const mcp = track(createClient(mcpServer.url, provider));

    await mcp.authenticate('fixture');

    expect(mcp.getServerAuthState('fixture')).toBe('authorized');
    await expect(mcp.listTools()).resolves.toBeDefined();

    // Dynamic client registration registered every callback-port candidate,
    // so a future fallback-bound port still matches a registered URI.
    expect(authServer.registrations).toHaveLength(1);
    expect(authServer.registrations[0]!.redirect_uris).toEqual(
      getCallbackUrlCandidates(callbackUrl).map(candidate => candidate.toString()),
    );

    // Tokens were persisted through the provider's storage.
    const tokens = await provider.tokens();
    expect(tokens?.access_token).toBeDefined();
    expect(authServer.validTokens.has(tokens!.access_token)).toBe(true);
  });

  it('reconnects with persisted tokens without a new browser flow', async () => {
    const { mcpServer, callbackUrl } = await setup();
    const storage = new InMemoryOAuthStorage();
    const provider = createProvider({ callbackUrl, storage, onRedirectToAuthorization: driveBrowser });
    const mcp = track(createClient(mcpServer.url, provider));
    await mcp.authenticate('fixture');
    await mcp.disconnect();

    // A fresh client sharing the same storage must connect silently.
    const silentProvider = createProvider({
      callbackUrl,
      storage,
      onRedirectToAuthorization: () => {
        throw new Error('Browser flow must not run when stored tokens are valid');
      },
    });
    const secondMcp = track(createClient(mcpServer.url, silentProvider));

    await secondMcp.reconnectServer('fixture');
    expect(secondMcp.getServerAuthState('fixture')).toBe('authorized');
  });

  it('refreshes an invalidated access token without a new browser flow', async () => {
    const { authServer, mcpServer, callbackUrl } = await setup();
    let browserRuns = 0;
    const provider = createProvider({
      callbackUrl,
      onRedirectToAuthorization: url => {
        browserRuns += 1;
        return driveBrowser(url);
      },
    });
    const mcp = track(createClient(mcpServer.url, provider));
    await mcp.authenticate('fixture');

    // Invalidate the access token server-side; the refresh token stays valid.
    const tokens = await provider.tokens();
    authServer.validTokens.delete(tokens!.access_token);

    await mcp.reconnectServer('fixture');

    expect(mcp.getServerAuthState('fixture')).toBe('authorized');
    expect(authServer.refreshGrantCount).toBe(1);
    expect(browserRuns).toBe(1);
  });

  it('re-registers when the stored client registration does not cover the callback URL', async () => {
    const { authServer, mcpServer, callbackUrl } = await setup();
    const provider = createProvider({ callbackUrl, onRedirectToAuthorization: driveBrowser });
    // Simulate a registration from an older configuration whose redirect_uris
    // no longer include the callback URL.
    await provider.saveClientInformation({
      client_id: 'stale-client',
      redirect_uris: ['http://127.0.0.1:9999/oauth/callback'],
    });
    const mcp = track(createClient(mcpServer.url, provider));

    await mcp.authenticate('fixture');

    expect(mcp.getServerAuthState('fixture')).toBe('authorized');
    expect(authServer.registrations).toHaveLength(1);
    expect(authServer.registrations[0]!.client_id).not.toBe('stale-client');
  });

  it('joins concurrent authenticate calls for the same server into one flow', async () => {
    const { authServer, mcpServer, callbackUrl } = await setup();
    const provider = createProvider({ callbackUrl, onRedirectToAuthorization: driveBrowser });
    const mcp = track(createClient(mcpServer.url, provider));

    await Promise.all([mcp.authenticate('fixture'), mcp.authenticate('fixture')]);

    expect(mcp.getServerAuthState('fixture')).toBe('authorized');
    expect(authServer.authorizeRedirectUris).toHaveLength(1);
  });

  it('authenticates different servers concurrently, falling back to a free callback port', async () => {
    const { authServer, mcpServer, ports, callbackUrl } = await setup();
    const secondMcpServer = await startProtectedMcpServer(ports.secondMcpPort, authServer);
    cleanups.push(() => secondMcpServer.close());

    const firstProvider = createProvider({ callbackUrl, onRedirectToAuthorization: driveBrowser });
    const secondProvider = createProvider({ callbackUrl, onRedirectToAuthorization: driveBrowser });
    const firstMcp = track(createClient(mcpServer.url, firstProvider));
    const secondMcp = track(createClient(secondMcpServer.url, secondProvider));

    await Promise.all([firstMcp.authenticate('fixture'), secondMcp.authenticate('fixture')]);

    expect(firstMcp.getServerAuthState('fixture')).toBe('authorized');
    expect(secondMcp.getServerAuthState('fixture')).toBe('authorized');
    // Both providers prefer the same callback port, so the flows must have
    // bound two different ports.
    const boundPorts = authServer.authorizeRedirectUris.map(uri => new URL(uri).port);
    expect(new Set(boundPorts).size).toBe(2);
    // Fallback binding must not drift the providers' preferred redirect URL:
    // the next flow starts from the preferred port again.
    expect(firstProvider.redirectUrl.toString()).toBe(callbackUrl);
    expect(secondProvider.redirectUrl.toString()).toBe(callbackUrl);
  });

  it('returns to needs-auth when the user denies authorization', async () => {
    const { authServer, mcpServer, callbackUrl } = await setup();
    authServer.denyAuthorization = true;
    const provider = createProvider({ callbackUrl, onRedirectToAuthorization: driveBrowser });
    const mcp = track(createClient(mcpServer.url, provider));

    await expect(mcp.authenticate('fixture')).rejects.toThrow(/access_denied/);
    expect(mcp.getServerAuthState('fixture')).toBe('needs-auth');
  });

  it('returns to needs-auth when the browser never delivers a code', async () => {
    const { mcpServer, callbackUrl } = await setup();
    // The "browser" never visits the authorization URL.
    const provider = createProvider({ callbackUrl, onRedirectToAuthorization: () => {} });
    const mcp = track(createClient(mcpServer.url, provider));

    await expect(mcp.authenticate('fixture', { timeoutMs: 300 })).rejects.toThrow(/Timed out/);
    expect(mcp.getServerAuthState('fixture')).toBe('needs-auth');
  });

  it('cancels a pending flow: the authenticate call rejects and the server returns to needs-auth', async () => {
    const { mcpServer, callbackUrl } = await setup();
    // The "browser" reaches the authorization URL but the redirect never comes
    // back (the user closed the tab), so the flow is left waiting for the code.
    let authorizationReached: (() => void) | undefined;
    const reachedAuthorization = new Promise<void>(resolve => {
      authorizationReached = resolve;
    });
    const provider = createProvider({
      callbackUrl,
      onRedirectToAuthorization: () => {
        authorizationReached?.();
      },
    });
    const mcp = track(createClient(mcpServer.url, provider));

    const flow = mcp.authenticate('fixture');
    await reachedAuthorization;

    const cancelled = await mcp.cancelAuthentication('fixture');
    expect(cancelled).toBe(true);

    await expect(flow).rejects.toThrow(/closed before receiving an authorization code/);
    expect(mcp.getServerAuthState('fixture')).toBe('needs-auth');
  });

  it('cancelAuthentication returns false when no flow is pending', async () => {
    const { mcpServer, callbackUrl } = await setup();
    const provider = createProvider({ callbackUrl, onRedirectToAuthorization: driveBrowser });
    const mcp = track(createClient(mcpServer.url, provider));

    await expect(mcp.cancelAuthentication('fixture')).resolves.toBe(false);
  });

  it('can authenticate again after a cancelled flow', async () => {
    const { mcpServer, callbackUrl } = await setup();
    let authorizationReached: (() => void) | undefined;
    const reachedAuthorization = new Promise<void>(resolve => {
      authorizationReached = resolve;
    });
    // First attempt stalls at the authorization URL; the retry drives the
    // browser through to completion.
    let driveOnRedirect = false;
    const provider = createProvider({
      callbackUrl,
      onRedirectToAuthorization: url => {
        if (driveOnRedirect) {
          return driveBrowser(url);
        }
        authorizationReached?.();
      },
    });
    const mcp = track(createClient(mcpServer.url, provider));

    const stalledFlow = mcp.authenticate('fixture');
    await reachedAuthorization;
    await mcp.cancelAuthentication('fixture');
    await expect(stalledFlow).rejects.toThrow(/closed before receiving an authorization code/);

    driveOnRedirect = true;
    await mcp.authenticate('fixture');
    expect(mcp.getServerAuthState('fixture')).toBe('authorized');
  });

  it('disconnect cancels a pending flow: the callback port is released and the flow settles', async () => {
    const { mcpServer, callbackUrl } = await setup();
    let authorizationReached: (() => void) | undefined;
    const reachedAuthorization = new Promise<void>(resolve => {
      authorizationReached = resolve;
    });
    const provider = createProvider({
      callbackUrl,
      onRedirectToAuthorization: () => {
        authorizationReached?.();
      },
    });
    const mcp = createClient(mcpServer.url, provider);

    const flow = mcp.authenticate('fixture');
    await reachedAuthorization;

    // Disconnecting mid-flow must close the callback server and settle the
    // pending authentication rather than leaving a bound port or a live promise.
    await mcp.disconnect();
    await expect(flow).rejects.toThrow(/closed before receiving an authorization code/);
  });

  it('cancels a flow still in its setup phase before the callback server binds', async () => {
    const { mcpServer, callbackUrl } = await setup();
    const provider = createProvider({ callbackUrl, onRedirectToAuthorization: driveBrowser });

    // Gate beginAuthorizationSession so the flow parks in setup — before the
    // callback server is created and stored — which is the window CodeRabbit
    // flagged as a deadlock/missed-cancellation risk.
    let reachSetup: (() => void) | undefined;
    const inSetup = new Promise<void>(resolve => {
      reachSetup = resolve;
    });
    let releaseSetup: (() => void) | undefined;
    const setupGate = new Promise<void>(resolve => {
      releaseSetup = resolve;
    });
    const originalBegin = provider.beginAuthorizationSession.bind(provider);
    provider.beginAuthorizationSession = async () => {
      reachSetup?.();
      await setupGate;
      return originalBegin();
    };

    const mcp = track(createClient(mcpServer.url, provider));
    const flow = mcp.authenticate('fixture');
    await inSetup;

    // Cancel while still in setup: no callback server exists yet, but abort must
    // be recorded so that once setup unblocks the flow bails at the signal check
    // instead of proceeding to park on waitForCode.
    const cancelPromise = mcp.cancelAuthentication('fixture');
    releaseSetup?.();
    const cancelled = await Promise.race([
      cancelPromise.then(() => 'cancelled' as const),
      new Promise<'timeout'>(resolve => setTimeout(() => resolve('timeout'), 2_000)),
    ]);
    expect(cancelled).toBe('cancelled');
    await expect(flow).rejects.toThrow(/cancelled/);
    // Cancellation during setup happens before the 401 handshake runs, so the
    // auth state was never advanced — the only guarantee is it is not authorized.
    expect(mcp.getServerAuthState('fixture')).not.toBe('authorized');
  });

  it('disconnect does not deadlock on a flow still in its setup phase', async () => {
    const { mcpServer, callbackUrl } = await setup();
    const provider = createProvider({ callbackUrl, onRedirectToAuthorization: driveBrowser });

    let reachSetup: (() => void) | undefined;
    const inSetup = new Promise<void>(resolve => {
      reachSetup = resolve;
    });
    let releaseSetup: (() => void) | undefined;
    const setupGate = new Promise<void>(resolve => {
      releaseSetup = resolve;
    });
    const originalBegin = provider.beginAuthorizationSession.bind(provider);
    provider.beginAuthorizationSession = async () => {
      reachSetup?.();
      await setupGate;
      return originalBegin();
    };

    const mcp = createClient(mcpServer.url, provider);
    const flow = mcp.authenticate('fixture');
    await inSetup;

    // disconnect() aborts the setup-phase flow first, then awaits its settlement.
    // Without the abort it would block forever on waitForCode.
    const disconnectPromise = mcp.disconnect();
    releaseSetup?.();
    const disconnected = await Promise.race([
      disconnectPromise.then(() => 'done' as const),
      new Promise<'timeout'>(resolve => setTimeout(() => resolve('timeout'), 2_000)),
    ]);
    expect(disconnected).toBe('done');
    await expect(flow).rejects.toThrow();
  });

  it('waits for an in-flight disconnect before starting a new authenticate flow', async () => {
    const { mcpServer, callbackUrl } = await setup();

    // First flow stalls at the authorization URL so a disconnect can catch it
    // mid-flight. The retry after disconnect drives the browser to completion.
    let authorizationReached: (() => void) | undefined;
    const reachedAuthorization = new Promise<void>(resolve => {
      authorizationReached = resolve;
    });
    let driveOnRedirect = false;
    const provider = createProvider({
      callbackUrl,
      onRedirectToAuthorization: url => {
        if (driveOnRedirect) {
          return driveBrowser(url);
        }
        authorizationReached?.();
      },
    });
    const mcp = track(createClient(mcpServer.url, provider));

    const stalledFlow = mcp.authenticate('fixture');
    await reachedAuthorization;

    // Start the disconnect and, without awaiting it, immediately kick off a new
    // authenticate. The guard must hold the new flow until disconnect finishes
    // clearing the auth-flow maps, so the retry does not race the teardown and
    // orphan its callback server.
    driveOnRedirect = true;
    const disconnectPromise = mcp.disconnect();
    const retryFlow = mcp.authenticate('fixture');

    await expect(stalledFlow).rejects.toThrow(/closed before receiving an authorization code/);
    await disconnectPromise;
    await retryFlow;
    expect(mcp.getServerAuthState('fixture')).toBe('authorized');
  });

  it('rejects authenticate for servers without an MCPOAuthClientProvider', async () => {
    const mcp = track(
      new MCPClient({
        id: `oauth-flow-test-${randomUUID()}`,
        servers: {
          fixture: { url: new URL('http://127.0.0.1:1/mcp') },
        },
      }),
    );

    await expect(mcp.authenticate('fixture')).rejects.toThrow(/not configured with an MCPOAuthClientProvider/);
  });

  it('rejects a redirect URL whose hostname only looks like loopback', async () => {
    const { mcpServer } = await setup();
    // 127.evil.com is not a loopback address; a naive startsWith('127.') check
    // would wrongly accept it and bind the callback server for an attacker host.
    const provider = createProvider({ callbackUrl: 'http://127.evil.com:9999/oauth/callback' });
    const mcp = track(createClient(mcpServer.url, provider));

    await expect(mcp.authenticate('fixture')).rejects.toThrow(/loopback address/);
    expect(mcp.getServerAuthState('fixture')).not.toBe('authorized');
  });
});
