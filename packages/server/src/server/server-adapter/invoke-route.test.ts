import { Mastra } from '@mastra/core/mastra';
import { RequestContext } from '@mastra/core/request-context';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { MASTRA_USER_KEY, MASTRA_USER_PERMISSIONS_KEY } from '../constants';
import { HTTPException } from '../http-exception';
import { createRoute } from './routes/route-builder';
import { dispatchRoute, invokeRoute, MastraServer } from './index';

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

/** An adapter that only needs to exist: constructing it records where routes are served. */
class TestAdapter extends MastraServer<any, any, any> {
  stream = vi.fn();
  getParams = vi.fn();
  sendResponse = vi.fn();
  registerRoute = vi.fn();
  registerContextMiddleware = vi.fn();
  registerAuthMiddleware = vi.fn();
  registerHttpLoggingMiddleware = vi.fn();
}

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

  // invokeRoute shares a pipeline with dispatchRoute but is a public API of its own: these pin
  // the places where it answers differently from an HTTP request, so the shared code cannot move them.
  describe('contract it does not share with dispatchRoute', () => {
    const traceRoute = (overrides: Record<string, unknown> = {}) =>
      createRoute({
        method: 'POST',
        path: '/observability/traces/:traceId',
        responseType: 'json',
        handler: async () => ({ ok: true }),
        ...overrides,
      } as any);
    const openMastra = () => new Mastra({ logger: false });

    it('reports the invalid path param first when the path, query and body are all invalid', async () => {
      const result = await invokeRoute(
        traceRoute({
          pathParamSchema: z.object({ traceId: z.string().uuid() }),
          queryParamSchema: z.object({ limit: z.coerce.number() }),
          bodySchema: z.object({ name: z.string() }),
        }),
        {
          mastra: openMastra(),
          requestContext: new RequestContext(),
          pathParams: { traceId: 'not-a-uuid' },
          query: { limit: 'many' },
          body: { name: 1 },
        },
      );

      expect(result).toMatchObject({ status: 400, body: { error: 'Invalid path parameters' } });
    });

    it('throws when a schema fails with something other than a validation error', async () => {
      const route = traceRoute({
        bodySchema: z.object({
          name: z.string().transform(() => {
            throw new Error('lookup service down');
          }),
        }),
      });

      await expect(
        invokeRoute(route, {
          mastra: openMastra(),
          requestContext: new RequestContext(),
          pathParams: { traceId: 't1' },
          body: { name: 'Ada' },
        }),
      ).rejects.toThrow('lookup service down');
    });

    it('answers with the standard error body when the handler raises an exception carrying its own response', async () => {
      const route = traceRoute({
        handler: async () => {
          throw new HTTPException(422, {
            message: 'Unsupported query',
            res: new Response(JSON.stringify({ custom: true }), { status: 409 }),
          });
        },
      });

      const result = await invokeRoute(route, {
        mastra: openMastra(),
        requestContext: new RequestContext(),
        pathParams: { traceId: 't1' },
      });

      expect(result).toEqual({ status: 422, body: { error: 'Unsupported query' } });
    });

    it('asks authorize about the path under server.apiPrefix even when an adapter is mounted elsewhere', async () => {
      const authorize = vi.fn(async () => true);
      const mastra = securedMastra({ authorize }, { apiPrefix: '/mastra' });
      new TestAdapter({ app: {}, mastra, prefix: '/mounted' });

      const result = await invokeRoute(traceRoute(), {
        mastra,
        requestContext: callerContext(['observability:write']),
        pathParams: { traceId: 't1' },
      });

      expect(result.status).toBe(200);
      expect(authorize.mock.calls[0]?.[0]).toBe('/mastra/observability/traces/t1');
    });

    it('leaves the segment of a path param that was not supplied empty in the path authorize sees', async () => {
      const authorize = vi.fn(async () => true);

      await invokeRoute(traceRoute(), {
        mastra: securedMastra({ authorize }),
        requestContext: callerContext(['observability:write']),
      });

      expect(authorize.mock.calls[0]?.[0]).toBe('/api/observability/traces/');
    });
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
      { mastra: securedMastra(), requestContext, abortSignal, routePrefix: '/api' },
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
      { mastra, requestContext: new RequestContext(), abortSignal, routePrefix: '/api' },
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

  describe('never allows more than an HTTP request to the route would', () => {
    const user = () => {
      const requestContext = new RequestContext();
      requestContext.set(MASTRA_USER_KEY, { id: 'user-1' });
      return requestContext;
    };

    /** Callers may list things but not touch a single one. */
    function thingsSetup() {
      const ran = vi.fn(async ({ thingId }: { thingId: string }) => ({ deleted: thingId }));
      const route = createRoute({
        method: 'DELETE',
        path: '/things/:thingId',
        responseType: 'json',
        pathParamSchema: z.object({ thingId: z.string() }),
        handler: ran as any,
      });
      const mastra = new Mastra({
        logger: false,
        server: {
          auth: {
            authenticateToken: async () => null,
            rules: [{ path: '/api/things', methods: ['GET', 'DELETE'], allow: true }],
          },
        },
      });
      const run = (thingId: unknown) =>
        dispatchRoute(
          route,
          { pathParams: { thingId } },
          { mastra, requestContext: user(), abortSignal, routePrefix: '/api' },
        );
      return { ran, run };
    }

    it('denies a single thing the rules do not allow', async () => {
      const { ran, run } = thingsSetup();
      expect(await run('x')).toMatchObject({ ok: false, status: 403 });
      expect(ran).not.toHaveBeenCalled();
    });

    // No URL reaches `/things/:thingId` with an empty id, so the rules for `/api/things` must not decide it.
    it.each([
      ['an empty id', ''],
      ['a missing id', undefined],
      ['a "." id', '.'],
      ['a ".." id', '..'],
      ['an id that is not text', { nested: true }],
    ])('rejects %s instead of authorizing a different path', async (_label, thingId) => {
      const { ran, run } = thingsSetup();
      const result = await run(thingId);
      expect(result).toMatchObject({
        ok: false,
        status: 400,
        body: { error: 'Invalid path parameters', issues: [{ field: 'thingId' }] },
      });
      expect(ran).not.toHaveBeenCalled();
    });

    it('refuses an anonymous caller on a server whose prefix is outside the protected paths', async () => {
      const ran = vi.fn(async () => ({ ran: true }));
      const route = createRoute({ method: 'GET', path: '/things', responseType: 'json', handler: ran as any });
      const mastra = new Mastra({ logger: false, server: { auth: { authenticateToken: async () => null } } });

      const result = await dispatchRoute(
        route,
        {},
        { mastra, requestContext: new RequestContext(), abortSignal, routePrefix: '/internal' },
      );

      expect(result).toMatchObject({ ok: false, status: 401 });
      expect(ran).not.toHaveBeenCalled();
    });

    it('refuses to guess the path when it is not told where the routes are served', async () => {
      const ran = vi.fn(async () => ({ ran: true }));
      const route = createRoute({ method: 'GET', path: '/things', responseType: 'json', handler: ran as any });
      const mastra = new Mastra({
        logger: false,
        server: { auth: { authenticateToken: async () => null, authorize: async () => true } },
      });

      // Not served by an adapter and no routePrefix: an anonymous caller is refused, a user cannot be authorized.
      expect(
        await dispatchRoute(route, {}, { mastra, requestContext: new RequestContext(), abortSignal }),
      ).toMatchObject({ ok: false, status: 401 });
      await expect(dispatchRoute(route, {}, { mastra, requestContext: user(), abortSignal })).rejects.toThrow(
        /routePrefix/,
      );
      expect(ran).not.toHaveBeenCalled();
    });

    it('refuses a prefix the server adapter does not serve, such as the empty one custom routes are given', async () => {
      const ran = vi.fn(async () => ({ ran: true }));
      const route = createRoute({ method: 'GET', path: '/things', responseType: 'json', handler: ran as any });
      const mastra = new Mastra({
        logger: false,
        server: { auth: { authenticateToken: async () => null, rules: [{ path: '/things', allow: true }] } },
      });
      // Serves the route at /api/things, which the rules deny.
      new TestAdapter({ app: {}, mastra, prefix: '/api' });

      await expect(
        dispatchRoute(route, {}, { mastra, requestContext: user(), abortSignal, routePrefix: '' }),
      ).rejects.toThrow(/routePrefix/);
      expect(await dispatchRoute(route, {}, { mastra, requestContext: user(), abortSignal })).toMatchObject({
        ok: false,
        status: 403,
      });
      expect(ran).not.toHaveBeenCalled();
    });

    it('does not let the request body stand in for what the server provides to handlers', async () => {
      const seen = vi.fn(async (params: Record<string, unknown>) => ({
        routePrefix: params.routePrefix ?? null,
        registeredTools: params.registeredTools ?? null,
        taskStore: params.taskStore ?? null,
        request: params.request ?? null,
      }));
      const route = createRoute({ method: 'POST', path: '/things', responseType: 'json', handler: seen as any });

      const result = await dispatchRoute(
        route,
        { body: { routePrefix: '/evil', registeredTools: { t: 1 }, taskStore: 'fake', request: 'fake' } },
        { mastra: new Mastra({ logger: false }), requestContext: new RequestContext(), abortSignal },
      );

      expect(result).toEqual({
        ok: true,
        result: { routePrefix: null, registeredTools: null, taskStore: null, request: null },
      });
    });
  });
});
