import type { IncomingMessage } from 'node:http';
import type { Mastra } from '@mastra/core/mastra';
import { RequestContext, MASTRA_AUTH_TOKEN_KEY } from '@mastra/core/request-context';
import { Hono } from 'hono';
import { describe, it, expect, vi } from 'vitest';
import { MastraServer } from '../index';

/**
 * Unit tests for the MCP req.auth bridge that the Hono adapter constructs in the
 * `mcp-http` branch. The bridge closes over the live Hono context and produces a
 * framework-agnostic `(req) => void` callback for `MCPServer.startHTTP` to invoke
 * before `transport.handleRequest`.
 *
 * Two modes are exercised here:
 * - Style B: explicit `server.mcp.setRequestAuth` receives `{ req, requestContext, token }`.
 * - Style A: provider-backed auto-bridge reads `user`/`token` already written into
 *   the Hono request context by the auth middleware and assigns `req.auth`.
 */

// Tiny subclass that exposes the otherwise-protected bridge builder for unit testing.
class TestableAdapter extends MastraServer {
  public expose_buildBridge(c: any) {
    return this.buildMcpRequestAuthBridge(c);
  }
}

interface BuildAdapterOpts {
  serverConfig?: Record<string, unknown>;
}

function buildAdapter({ serverConfig = {} }: BuildAdapterOpts = {}) {
  const app = new Hono<any, any, any>();
  const mastra = {
    getServer: () => serverConfig,
    getLogger: () => undefined,
    setMastraServer: vi.fn(),
  } as unknown as Mastra;

  return new TestableAdapter({ app: app as any, mastra });
}

function makeMockRequestContext(initial: Record<string, unknown> = {}) {
  const rc = new RequestContext();
  for (const [k, v] of Object.entries(initial)) rc.set(k, v);
  return rc;
}

function makeMockHonoContext(opts: { requestContext: RequestContext; authHeader?: string }) {
  const { requestContext, authHeader } = opts;
  return {
    get: (key: string) => (key === 'requestContext' ? requestContext : undefined),
    req: {
      header: (name: string) => (name === 'Authorization' ? authHeader : undefined),
    },
  } as any;
}

function makeMockReq() {
  return {} as IncomingMessage & { auth?: unknown };
}

describe('Hono adapter: buildMcpRequestAuthBridge', () => {
  it('returns undefined when no provider and no manual hook configured', () => {
    const adapter = buildAdapter();
    const c = makeMockHonoContext({ requestContext: makeMockRequestContext() });
    expect(adapter.expose_buildBridge(c)).toBeUndefined();
  });

  describe('Style B: manual setRequestAuth hook', () => {
    it('passes the live requestContext and bearer token from the Authorization header', async () => {
      const calls: Array<{ req: unknown; requestContext: RequestContext; token?: string }> = [];
      const adapter = buildAdapter({
        serverConfig: {
          mcp: {
            setRequestAuth: (args: { req: IncomingMessage; requestContext: RequestContext; token?: string }) => {
              calls.push(args);
              (args.req as any).auth = { token: args.token, clientId: 'demo' };
            },
          },
        },
      });

      const requestContext = makeMockRequestContext({ 'auth.payload': { sub: 'u1' } });
      const c = makeMockHonoContext({ requestContext, authHeader: 'Bearer raw-token-from-header' });

      const bridge = adapter.expose_buildBridge(c)!;
      expect(bridge).toBeTypeOf('function');

      const req = makeMockReq();
      await bridge(req);

      expect(calls).toHaveLength(1);
      expect(calls[0].requestContext).toBe(requestContext);
      expect(calls[0].requestContext.get('auth.payload')).toEqual({ sub: 'u1' });
      expect(calls[0].token).toBe('raw-token-from-header');
      expect((req as any).auth).toEqual({ token: 'raw-token-from-header', clientId: 'demo' });
    });

    it('falls back to the requestContext token when no Authorization header is present', async () => {
      const calls: Array<{ token?: string }> = [];
      const adapter = buildAdapter({
        serverConfig: {
          mcp: {
            setRequestAuth: (args: { token?: string }) => calls.push({ token: args.token }),
          },
        },
      });

      const requestContext = makeMockRequestContext({ [MASTRA_AUTH_TOKEN_KEY]: 'token-from-context' });
      const c = makeMockHonoContext({ requestContext });
      await adapter.expose_buildBridge(c)!(makeMockReq());

      expect(calls[0].token).toBe('token-from-context');
    });

    it('prefers the resolved requestContext token over the raw Authorization header', async () => {
      const calls: Array<{ token?: string }> = [];
      const adapter = buildAdapter({
        serverConfig: {
          mcp: {
            setRequestAuth: (args: { token?: string }) => calls.push({ token: args.token }),
          },
        },
      });

      const requestContext = makeMockRequestContext({ [MASTRA_AUTH_TOKEN_KEY]: 'context-token' });
      const c = makeMockHonoContext({ requestContext, authHeader: 'Bearer raw-token-from-header' });
      await adapter.expose_buildBridge(c)!(makeMockReq());

      expect(calls[0].token).toBe('context-token');
    });

    it('takes precedence over the auto-bridge even when an auth provider is configured', async () => {
      const manualHook = vi.fn();
      const adapter = buildAdapter({
        serverConfig: {
          mcp: { setRequestAuth: manualHook },
          auth: { authenticateToken: () => ({ id: 'u1' }) }, // looks like a provider
        },
      });

      const requestContext = makeMockRequestContext({ user: { id: 'u1' }, [MASTRA_AUTH_TOKEN_KEY]: 'tkn' });
      const c = makeMockHonoContext({ requestContext });
      const req = makeMockReq();
      await adapter.expose_buildBridge(c)!(req);

      expect(manualHook).toHaveBeenCalledTimes(1);
      // Manual hook didn't assign req.auth itself, and the auto-bridge never ran.
      expect((req as any).auth).toBeUndefined();
    });

    it('ignores a non-string token written into the requestContext', async () => {
      const calls: Array<{ token?: string }> = [];
      const adapter = buildAdapter({
        serverConfig: {
          mcp: { setRequestAuth: (args: { token?: string }) => calls.push({ token: args.token }) },
        },
      });

      // Defensive: someone wrote a non-string under the token key.
      const requestContext = makeMockRequestContext({ [MASTRA_AUTH_TOKEN_KEY]: { not: 'a string' } });
      const c = makeMockHonoContext({ requestContext });
      await adapter.expose_buildBridge(c)!(makeMockReq());

      expect(calls[0].token).toBeUndefined();
    });
  });

  describe('Style A: provider auto-bridge', () => {
    it('detects an auth provider via capability (typeof authenticateToken === function), not instanceof', () => {
      const adapter = buildAdapter({
        serverConfig: {
          // Plain object with MastraAuthProvider capability, no class identity needed.
          auth: { authenticateToken: () => null },
        },
      });
      const c = makeMockHonoContext({ requestContext: makeMockRequestContext({ user: { id: 'u1' } }) });
      expect(adapter.expose_buildBridge(c)).toBeTypeOf('function');
    });

    it('writes req.auth using the default mapping when user + token are present', () => {
      const adapter = buildAdapter({
        serverConfig: { auth: { authenticateToken: () => null } },
      });
      const requestContext = makeMockRequestContext({
        user: { sub: 'u-1', scope: 'read write' },
        [MASTRA_AUTH_TOKEN_KEY]: 'tkn',
      });
      const c = makeMockHonoContext({ requestContext });
      const req = makeMockReq();
      adapter.expose_buildBridge(c)!(req);

      expect((req as any).auth).toMatchObject({
        token: 'tkn',
        clientId: 'u-1',
        scopes: ['read', 'write'],
      });
      // user is preserved under .extra so callers can recover provider-specific fields.
      expect((req as any).auth.extra).toEqual({ user: { sub: 'u-1', scope: 'read write' } });
    });

    it('honors mapUserToAuthInfo override', () => {
      const adapter = buildAdapter({
        serverConfig: {
          auth: { authenticateToken: () => null },
          mcp: {
            mapUserToAuthInfo: ({ user, token }: { user: any; token?: string }) => ({
              token,
              clientId: `custom:${user.id}`,
              scopes: ['admin'],
              extra: {},
            }),
          },
        },
      });
      const requestContext = makeMockRequestContext({
        user: { id: '42' },
        [MASTRA_AUTH_TOKEN_KEY]: 'tkn',
      });
      const c = makeMockHonoContext({ requestContext });
      const req = makeMockReq();
      adapter.expose_buildBridge(c)!(req);

      expect((req as any).auth).toEqual({
        token: 'tkn',
        clientId: 'custom:42',
        scopes: ['admin'],
        extra: {},
      });
    });

    it('is a no-op when no user is in the request context (never fabricates authInfo)', () => {
      const adapter = buildAdapter({
        serverConfig: { auth: { authenticateToken: () => null } },
      });
      // No user written: auth middleware did not run / route was not protected.
      const c = makeMockHonoContext({ requestContext: makeMockRequestContext() });
      const req = makeMockReq();
      adapter.expose_buildBridge(c)!(req);

      expect((req as any).auth).toBeUndefined();
    });

    it('returns undefined when autoBridgeAuth is explicitly disabled', () => {
      const adapter = buildAdapter({
        serverConfig: {
          auth: { authenticateToken: () => null },
          mcp: { autoBridgeAuth: false },
        },
      });
      const c = makeMockHonoContext({ requestContext: makeMockRequestContext({ user: { id: 'u1' } }) });
      expect(adapter.expose_buildBridge(c)).toBeUndefined();
    });
  });
});

/**
 * Wiring test: proves the `mcp-http` branch of `sendResponse` actually passes the
 * bridge-built `setRequestAuth` into `server.startHTTP`. The bridge semantics are
 * covered above; this guards the integration seam against future refactors of
 * `sendResponse` silently dropping the hook.
 */
describe('Hono adapter: sendResponse(mcp-http) wires setRequestAuth into startHTTP', () => {
  function makeRouteContext(opts: { requestContext: RequestContext; url: string }) {
    // Real web Request so toReqRes(response.req.raw) works inside sendResponse.
    const raw = new Request(opts.url, { method: 'POST' });
    return {
      get: (key: string) => (key === 'requestContext' ? opts.requestContext : undefined),
      header: () => undefined,
      req: {
        raw,
        url: opts.url,
        header: () => undefined,
      },
    } as any;
  }

  it('passes a setRequestAuth callback to startHTTP when server.mcp.setRequestAuth is configured', async () => {
    const userHook = vi.fn();
    const adapter = buildAdapter({
      serverConfig: { mcp: { setRequestAuth: userHook } },
    });

    let captured: ((req: IncomingMessage) => void | Promise<void>) | undefined;
    const fakeServer = {
      startHTTP: vi.fn(async (args: { res: any; setRequestAuth?: (req: IncomingMessage) => void | Promise<void> }) => {
        captured = args.setRequestAuth;
        // End the response so sendResponse's toFetchResponse(res) can resolve.
        args.res.writeHead(200, { 'Content-Type': 'application/json' });
        args.res.end('{}');
      }),
    };

    const requestContext = makeMockRequestContext({ 'auth.payload': { sub: 'u1' } });
    const c = makeRouteContext({ requestContext, url: 'http://localhost/api/mcp/my-server/mcp' });

    await adapter.sendResponse({ responseType: 'mcp-http' } as any, c, {
      server: fakeServer,
      httpPath: '/mcp/my-server/mcp',
    } as any);

    expect(fakeServer.startHTTP).toHaveBeenCalledTimes(1);
    expect(captured).toBeTypeOf('function');

    // The captured callback must be the bridge: invoking it forwards to the user hook
    // with the live requestContext.
    await captured!({} as IncomingMessage);
    expect(userHook).toHaveBeenCalledTimes(1);
    expect(userHook.mock.calls[0][0].requestContext).toBe(requestContext);
  });

  it('passes setRequestAuth: undefined to startHTTP when no bridge applies', async () => {
    const adapter = buildAdapter({ serverConfig: {} }); // no auth provider, no manual hook

    const calls: Array<{ setRequestAuth?: unknown }> = [];
    const fakeServer = {
      startHTTP: vi.fn(async (args: { res: any; setRequestAuth?: unknown }) => {
        calls.push({ setRequestAuth: args.setRequestAuth });
        args.res.writeHead(200, { 'Content-Type': 'application/json' });
        args.res.end('{}');
      }),
    };

    const c = makeRouteContext({
      requestContext: makeMockRequestContext(),
      url: 'http://localhost/api/mcp/my-server/mcp',
    });

    await adapter.sendResponse({ responseType: 'mcp-http' } as any, c, {
      server: fakeServer,
      httpPath: '/mcp/my-server/mcp',
    } as any);

    expect(fakeServer.startHTTP).toHaveBeenCalledTimes(1);
    expect(calls[0].setRequestAuth).toBeUndefined();
  });

  it('does not leak server.mcp auth config into the transport options', async () => {
    const adapter = buildAdapter({
      serverConfig: { mcp: { setRequestAuth: vi.fn(), autoBridgeAuth: true, mapUserToAuthInfo: vi.fn() } },
    });

    let capturedOptions: Record<string, unknown> | undefined;
    const fakeServer = {
      startHTTP: vi.fn(async (args: { res: any; options?: Record<string, unknown> }) => {
        capturedOptions = args.options;
        args.res.writeHead(200, { 'Content-Type': 'application/json' });
        args.res.end('{}');
      }),
    };

    const c = makeRouteContext({
      requestContext: makeMockRequestContext(),
      url: 'http://localhost/api/mcp/my-server/mcp',
    });

    await adapter.sendResponse({ responseType: 'mcp-http' } as any, c, {
      server: fakeServer,
      httpPath: '/mcp/my-server/mcp',
    } as any);

    // options is undefined here (no transport mcpOptions). Crucially, none of the
    // auth-bridge fields leaked into transport options.
    if (capturedOptions) {
      expect(capturedOptions).not.toHaveProperty('setRequestAuth');
      expect(capturedOptions).not.toHaveProperty('autoBridgeAuth');
      expect(capturedOptions).not.toHaveProperty('mapUserToAuthInfo');
    } else {
      expect(capturedOptions).toBeUndefined();
    }
  });
});
