import { Mastra } from '@mastra/core/mastra';
import { RequestContext } from '@mastra/core/request-context';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { MASTRA_USER_KEY, MASTRA_USER_PERMISSIONS_KEY } from '../constants';
import { HTTPException } from '../http-exception';
import { createRoute } from './routes/route-builder';
import { dispatchRoute, invokeRoute } from './index';

const handler = vi.fn(async ({ name, requestContext }: { name: string; requestContext: RequestContext }) => ({
  greeting: `hello ${name}`,
  caller: (requestContext.get(MASTRA_USER_KEY) as { id: string }).id,
}));

const greetRoute = createRoute({
  method: 'POST',
  path: '/observability/greet',
  responseType: 'json',
  requiresPermission: 'observability:read',
  bodySchema: z.object({ name: z.string() }),
  handler: handler as any,
});

const failingRoute = createRoute({
  method: 'POST',
  path: '/observability/fail',
  responseType: 'json',
  requiresPermission: 'observability:read',
  handler: async () => {
    throw new HTTPException(422, { message: 'Unsupported query' });
  },
});

function securedMastra(
  auth: Record<string, unknown> = { authorize: async () => true },
  server: Record<string, unknown> = {},
) {
  return new Mastra({
    logger: false,
    server: {
      auth: { authenticateToken: async () => null, ...auth },
      rbac: { getPermissions: async () => [], getRoles: async () => [] } as any,
      ...server,
    },
  });
}

/** The request context Mastra server auth leaves behind for an authenticated caller. */
function callerContext(permissions: string[]) {
  const requestContext = new RequestContext();
  requestContext.set(MASTRA_USER_KEY, { id: 'user-1' });
  requestContext.set('user', { id: 'user-1' });
  requestContext.set(MASTRA_USER_PERMISSIONS_KEY, permissions);
  return requestContext;
}

describe('invokeRoute', () => {
  it('runs the route as the caller when they hold its permission', async () => {
    const result = await invokeRoute(greetRoute, {
      mastra: securedMastra(),
      requestContext: callerContext(['observability:read']),
      body: { name: 'Ada' },
    });

    expect(result).toEqual({ status: 200, body: { greeting: 'hello Ada', caller: 'user-1' } });
  });

  it('refuses a caller Mastra did not authenticate, without running the route', async () => {
    handler.mockClear();
    const result = await invokeRoute(greetRoute, {
      mastra: securedMastra(),
      requestContext: new RequestContext(),
      body: { name: 'Ada' },
    });

    expect(result.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it('refuses a user that did not come from Mastra server auth', async () => {
    handler.mockClear();
    // `@mastra/mcp` writes the legacy `user` key from the MCP server's own auth mapper.
    const requestContext = new RequestContext();
    requestContext.set('user', { id: 'mapped-user' });
    requestContext.set(MASTRA_USER_PERMISSIONS_KEY, ['observability:read']);

    const result = await invokeRoute(greetRoute, { mastra: securedMastra(), requestContext, body: { name: 'Ada' } });

    expect(result.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it('refuses routes that do not answer with JSON', async () => {
    const streamRoute = createRoute({
      method: 'POST',
      path: '/observability/stream',
      responseType: 'stream',
      handler: async () => new ReadableStream(),
    });

    await expect(
      invokeRoute(streamRoute, { mastra: securedMastra(), requestContext: callerContext(['observability:read']) }),
    ).rejects.toThrow(/only runs JSON routes/);
  });

  it('refuses a caller missing the route permission, without running the route', async () => {
    handler.mockClear();
    const result = await invokeRoute(greetRoute, {
      mastra: securedMastra(),
      requestContext: callerContext(['agents:read']),
      body: { name: 'Ada' },
    });

    expect(result).toEqual({
      status: 403,
      body: { error: 'Forbidden', message: 'Missing required permission: observability:read' },
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it('rejects input the route schema rejects, as the HTTP endpoint does', async () => {
    const result = await invokeRoute(greetRoute, {
      mastra: securedMastra(),
      requestContext: callerContext(['observability:read']),
      body: { name: 42 },
    });

    expect(result.status).toBe(400);
    expect(JSON.stringify(result.body)).toContain('name');
  });

  it('answers with the status the route handler raised', async () => {
    const result = await invokeRoute(failingRoute, {
      mastra: securedMastra(),
      requestContext: callerContext(['observability:read']),
    });

    expect(result).toEqual({ status: 422, body: { error: 'Unsupported query' } });
  });

  describe("server auth's authorization hooks", () => {
    it('asks authorize about the route itself, under the server API prefix', async () => {
      const authorize = vi.fn(async () => true);
      const route = createRoute({
        method: 'GET',
        path: '/observability/traces/:traceId',
        responseType: 'json',
        requiresPermission: 'observability:read',
        handler: async () => ({ ok: true }),
      });

      const result = await invokeRoute(route, {
        mastra: securedMastra({ authorize }, { apiPrefix: '/mastra' }),
        requestContext: callerContext(['observability:read']),
        pathParams: { traceId: 'trace 1' },
      });

      expect(result.status).toBe(200);
      expect(authorize).toHaveBeenCalledWith(
        '/mastra/observability/traces/trace%201',
        'GET',
        { id: 'user-1' },
        expect.anything(),
      );
    });

    it.each([
      ['authorize', { authorize: async (path: string) => !path.includes('/observability') }],
      ['authorizeUser', { authorizeUser: async () => false }],
      ['rules', { rules: [{ path: '/api/agents/*', allow: true }] }],
    ])('refuses the call when %s denies the route, without running it', async (_, auth) => {
      handler.mockClear();
      const result = await invokeRoute(greetRoute, {
        mastra: securedMastra(auth),
        requestContext: callerContext(['observability:read']),
        body: { name: 'Ada' },
      });

      expect(result).toEqual({ status: 403, body: { error: 'Access denied' } });
      expect(handler).not.toHaveBeenCalled();
    });
  });

  it('runs without a user when the server has no auth configured', async () => {
    const result = await invokeRoute(failingRoute, {
      mastra: new Mastra({ logger: false }),
      requestContext: new RequestContext(),
    });

    expect(result.status).toBe(422);
  });
});

// dispatchRoute and invokeRoute share one pipeline; these pin where they are meant to differ and where they must not.
describe('dispatchRoute', () => {
  const abortSignal = new AbortController().signal;

  it('refuses a user that did not come from Mastra server auth, like invokeRoute', async () => {
    handler.mockClear();
    const requestContext = new RequestContext();
    requestContext.set('user', { id: 'mapped-user' });
    requestContext.set(MASTRA_USER_PERMISSIONS_KEY, ['observability:read']);

    const result = await dispatchRoute(
      greetRoute,
      { body: { name: 'Ada' } },
      { mastra: securedMastra(), requestContext, abortSignal },
    );

    expect(result).toMatchObject({ ok: false, status: 401 });
    expect(handler).not.toHaveBeenCalled();
  });

  it('reaches a path server auth declares public without a user, as HTTP does, while invokeRoute still refuses', async () => {
    const publicRoute = createRoute({
      method: 'GET',
      path: '/observability/ping',
      responseType: 'json',
      handler: async () => ({ pong: true }),
    });
    const mastra = new Mastra({
      logger: false,
      server: { auth: { authenticateToken: async () => null, public: ['/api/observability/ping'] } },
    });

    const dispatched = await dispatchRoute(
      publicRoute,
      {},
      { mastra, requestContext: new RequestContext(), abortSignal },
    );
    const invoked = await invokeRoute(publicRoute, { mastra, requestContext: new RequestContext() });

    expect(dispatched).toEqual({ ok: true, result: { pong: true } });
    expect(invoked.status).toBe(401);
  });

  it('acts on the resource named in the path when the body names another one', async () => {
    const seen = vi.fn(async ({ traceId }: { traceId: string }) => ({ traceId }));
    const route = createRoute({
      method: 'POST',
      path: '/observability/traces/:traceId',
      responseType: 'json',
      handler: seen as any,
    });

    const result = await dispatchRoute(
      route,
      { pathParams: { traceId: 'mine' }, body: { traceId: 'someone-elses' } },
      { mastra: new Mastra({ logger: false }), requestContext: new RequestContext(), abortSignal },
    );

    expect(result).toEqual({ ok: true, result: { traceId: 'mine' } });
  });
});
