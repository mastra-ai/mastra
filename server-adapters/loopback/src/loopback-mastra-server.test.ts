import { RestBindings } from '@loopback/rest';
import type { RouteEntry } from '@loopback/rest';
import { RequestContext as MastraRequestContext } from '@mastra/core/request-context';
import { describe, expect, it, vi } from 'vitest';

import { FakeResponse, createFakeRequest, getWrittenText } from './__tests__/support/fakes.js';
import { MastraLoopbackBindings } from './bindings.js';
import { toLoopbackMethods } from './internal/path-utils.js';
import { toWebRequest } from './internal/request-utils.js';
import { LoopbackResponseWriter } from './internal/response-writer.js';
import { LoopbackMastraServer } from './loopback-mastra-server.js';

class FakeApp {
  readonly routes: RouteEntry[] = [];
  readonly bindings = new Map<unknown, unknown>();

  bind(key: unknown): {
    to: (value: unknown) => { inScope: (_scope: unknown) => void };
    inScope: (_scope: unknown) => void;
  } {
    return {
      to: value => {
        this.bindings.set(key, value);
        return {
          inScope: () => undefined,
        };
      },
      inScope: () => undefined,
    };
  }

  isBound(key: unknown): boolean {
    return this.bindings.has(key);
  }

  component(_component: unknown): void {
    this.bindings.set('component:MastraLoopbackComponent', true);
  }

  route(route: RouteEntry): unknown {
    this.routes.push(route);
    return {};
  }
}

class FakeRequestContext {
  readonly values = new Map<unknown, unknown>();

  bind(key: unknown): { to: (value: unknown) => void } {
    return {
      to: value => {
        this.values.set(key, value);
      },
    };
  }

  async get<T>(key: unknown): Promise<T> {
    return this.values.get(key) as T;
  }

  getSync<T>(key: unknown): T {
    return this.values.get(key) as T;
  }

  isBound(key: unknown): boolean {
    return this.values.has(key);
  }
}

function createServer(config?: Record<string, unknown>, app?: FakeApp): LoopbackMastraServer {
  const mastra = {
    getServer: () => ({}),
    setMastraServer: () => undefined,
  };

  return new LoopbackMastraServer({
    app: (app ?? new FakeApp()) as unknown as never,
    mastra: mastra as never,
    config: (config ?? {}) as never,
  });
}

describe('LoopbackMastraServer', () => {
  it('registers native loopback route with normalized path', async () => {
    const app = new FakeApp();
    const server = createServer({ prefix: '/api/mastra' }, app);
    const route = {
      method: 'GET',
      path: '/agents/:id',
      handler: async () => ({ ok: true }),
      responseType: 'json',
    };

    await server.registerRoute(app as unknown as never, route as never, {});

    expect(app.routes).toHaveLength(1);
    expect(app.routes[0]?.path).toBe('/api/mastra/agents/{id}');
    expect(app.routes[0]?.verb).toBe('get');
  });

  it('binds request scoped context and returns auth error when check fails', async () => {
    const app = new FakeApp();
    const authorize = vi.fn(async () => ({ status: 401, error: 'Unauthorized' }));
    const server = createServer(
      {
        auth: {
          enabled: true,
          authorizeMode: 'replace',
          authorize,
        },
      },
      app,
    );

    let handlerCalled = false;
    const route = {
      method: 'GET',
      path: '/secure',
      responseType: 'json',
      handler: async () => {
        handlerCalled = true;
        return { ok: true };
      },
    };

    await server.registerRoute(app as unknown as never, route as never, {});
    const entry = app.routes[0];
    expect(entry).toBeDefined();

    const req = createFakeRequest();
    const res = new FakeResponse();
    const requestContext = new FakeRequestContext();
    requestContext.values.set(RestBindings.Http.REQUEST, req);
    requestContext.values.set(RestBindings.Http.RESPONSE, res);

    await entry?.invokeHandler(requestContext as unknown as never, []);

    expect(authorize).toHaveBeenCalledTimes(1);
    expect(handlerCalled).toBe(false);
    expect(res.statusCode).toBe(401);
    expect(res.jsonBody).toEqual({ error: 'Unauthorized' });
  });

  it('returns 400 when body parsing fails', async () => {
    const app = new FakeApp();
    const server = createServer({ enableAuth: false }, app);
    (server as unknown as { parseBody: () => Promise<unknown> }).parseBody = vi.fn(async () => {
      throw new Error('Malformed request body');
    });

    let handlerCalled = false;
    const route = {
      method: 'POST',
      path: '/parse',
      responseType: 'json',
      handler: async () => {
        handlerCalled = true;
        return { ok: true };
      },
    };

    await server.registerRoute(app as unknown as never, route as never, {});
    const entry = app.routes[0];
    expect(entry).toBeDefined();

    const req = createFakeRequest({ method: 'POST', path: '/parse', body: '{bad json}' });
    const res = new FakeResponse();
    const requestContext = new FakeRequestContext();
    requestContext.values.set(RestBindings.Http.REQUEST, req);
    requestContext.values.set(RestBindings.Http.RESPONSE, res);

    await entry?.invokeHandler(requestContext as unknown as never, []);

    expect(handlerCalled).toBe(false);
    expect(res.statusCode).toBe(400);
    expect(res.jsonBody).toEqual({ error: 'Malformed request body' });
  });

  it('passes a Mastra RequestContext with a LoopBack bridge to route handlers', async () => {
    const app = new FakeApp();
    const server = createServer(undefined, app);
    const injectedRepository = { findById: vi.fn(async (id: string) => ({ id, name: 'Ada' })) };
    let capturedContext: MastraRequestContext | undefined;
    let resolvedRepository: unknown;

    const route = {
      method: 'GET',
      path: '/customers/:id',
      responseType: 'json',
      handler: async ({
        requestContext,
        params,
      }: {
        requestContext: MastraRequestContext;
        params: Record<string, string>;
      }) => {
        capturedContext = requestContext;
        const loopback = requestContext.get('loopback') as {
          resolve: (binding: string) => Promise<unknown>;
          isBound: (binding: string) => boolean;
        };
        resolvedRepository = await loopback.resolve('repositories.CustomerRepository');
        return {
          customerId: params.id,
          customer: await (resolvedRepository as { findById: (id: string) => Promise<unknown> }).findById(params.id),
          repoBound: loopback.isBound('repositories.CustomerRepository'),
        };
      },
    };

    await server.registerRoute(app as unknown as never, route as never, {});
    const entry = app.routes[0];
    expect(entry).toBeDefined();

    const req = createFakeRequest({
      method: 'GET',
      path: '/customers/123',
      params: { id: '123' },
      query: { requestContext: JSON.stringify({ tenantId: 'tenant-1' }) },
    });
    const res = new FakeResponse();
    const requestContext = new FakeRequestContext();
    requestContext.values.set(RestBindings.Http.REQUEST, req);
    requestContext.values.set(RestBindings.Http.RESPONSE, res);
    requestContext.values.set('repositories.CustomerRepository', injectedRepository);

    await entry?.invokeHandler(requestContext as unknown as never, []);

    expect(capturedContext).toBeInstanceOf(MastraRequestContext);
    expect(capturedContext?.get('tenantId')).toBe('tenant-1');
    expect(capturedContext?.get('loopback')).toMatchObject({
      app,
      context: requestContext,
      request: req,
      response: res,
    });
    expect(resolvedRepository).toBe(injectedRepository);
    expect(res.jsonBody).toEqual({
      customerId: '123',
      customer: { id: '123', name: 'Ada' },
      repoBound: true,
    });
  });

  it('sendResponse supports response envelopes', async () => {
    const server = createServer();
    const res = new FakeResponse();

    await server.sendResponse({ responseType: 'json' } as never, res as unknown as never, {
      status: 202,
      headers: { 'x-trace-id': 'trace-1' },
      body: { ok: true },
    });

    expect(res.statusCode).toBe(202);
    expect(res.getHeader('x-trace-id')).toBe('trace-1');
    expect(res.jsonBody).toEqual({ ok: true });
  });

  it('sendResponse writes Uint8Array bodies as binary', async () => {
    const server = createServer();
    const res = new FakeResponse();
    const body = new Uint8Array([1, 2, 3]);

    await server.sendResponse({ responseType: 'json' } as never, res as unknown as never, body);

    expect(res.getHeader('content-type')).toBe('application/octet-stream');
    expect(res.jsonBody).toBeUndefined();
    expect(res.writes).toEqual([Buffer.from(body)]);
    expect(res.ended).toBe(true);
  });

  it('stream writes SSE output and done marker', async () => {
    const server = createServer();
    const res = new FakeResponse();
    const route = { responseType: 'stream', streamFormat: 'sse' } as never;

    async function* chunks() {
      yield 'hello';
      yield { delta: 'world' };
    }

    await server.stream(route, res as unknown as never, chunks());

    expect(res.getHeader('content-type')).toBe('text/event-stream');
    expect(res.flushed).toBe(true);
    const text = getWrittenText(res);
    expect(text).toContain('data: hello');
    expect(text).toContain('data: {"delta":"world"}');
    expect(text).toContain('event: done');
  });

  it('stream writes a Uint8Array result as one binary chunk', async () => {
    const server = createServer();
    const res = new FakeResponse();
    const body = new Uint8Array([65, 66, 67]);

    await server.stream({ responseType: 'stream' } as never, res as unknown as never, body);

    expect(res.getHeader('content-type')).toBe('text/plain; charset=utf-8');
    expect(res.writes).toEqual([Buffer.from(body)]);
    expect(res.ended).toBe(true);
  });

  it('sendResponse handles datastream fetch-like responses', async () => {
    const server = createServer();
    const res = new FakeResponse();
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('chunk-1'));
        controller.enqueue(encoder.encode('chunk-2'));
        controller.close();
      },
    });

    await server.sendResponse({ responseType: 'datastream-response' } as never, res as unknown as never, {
      status: 207,
      headers: new Headers({ 'x-stream': 'true' }),
      body,
    });

    expect(res.statusCode).toBe(207);
    expect(res.getHeader('x-stream')).toBe('true');
    expect(getWrittenText(res)).toContain('chunk-1chunk-2');
    expect(res.ended).toBe(true);
  });

  it('hides 5xx error messages unless the error is explicitly exposed', () => {
    const writer = new LoopbackResponseWriter({
      applyStreamRedaction: async chunk => chunk,
    });

    const internalRes = new FakeResponse();
    writer.sendErrorResponse(internalRes as unknown as never, { status: 500, message: 'database secret leaked' });
    expect(internalRes.jsonBody).toEqual({ error: 'Internal Server Error' });

    const exposedRes = new FakeResponse();
    writer.sendErrorResponse(exposedRes as unknown as never, {
      status: 500,
      message: 'public maintenance message',
      expose: true,
    });
    expect(exposedRes.jsonBody).toEqual({ error: 'public maintenance message' });

    const clientRes = new FakeResponse();
    writer.sendErrorResponse(clientRes as unknown as never, { status: 400, message: 'Invalid request' });
    expect(clientRes.jsonBody).toEqual({ error: 'Invalid request' });
  });

  it('expands ALL custom routes to include HEAD and OPTIONS', () => {
    expect(toLoopbackMethods('ALL')).toEqual(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']);
  });

  it('marks JSON-stringified web request bodies with an application/json content type', async () => {
    const request = toWebRequest(
      createFakeRequest({
        method: 'POST',
        path: '/json',
        originalUrl: '/json',
        url: '/json',
        headers: {
          'content-type': 'text/plain',
        },
        body: { ok: true },
      }) as never,
    );

    expect(request.headers.get('content-type')).toBe('application/json');
    expect(await request.text()).toBe('{"ok":true}');
  });

  it('sendResponse delegates mcp-http and mcp-sse to server hooks', async () => {
    const server = createServer({ prefix: '/api/mastra' });
    const req = createFakeRequest();
    const httpRes = new FakeResponse();
    const sseRes = new FakeResponse();
    const startHTTP = vi.fn(async () => undefined);
    const startSSE = vi.fn(async () => undefined);

    await server.sendResponse(
      { responseType: 'mcp-http' } as never,
      httpRes as unknown as never,
      {
        server: { startHTTP },
        httpPath: '/mcp/http',
        mcpOptions: { mode: 'http' },
      },
      req as never,
    );

    await server.sendResponse(
      { responseType: 'mcp-sse' } as never,
      sseRes as unknown as never,
      {
        server: { startSSE },
        ssePath: '/mcp/sse',
        messagePath: '/mcp/message',
        mcpOptions: { mode: 'sse' },
      },
      req as never,
    );

    expect(startHTTP).toHaveBeenCalledTimes(1);
    expect(startSSE).toHaveBeenCalledTimes(1);
    expect(startHTTP.mock.calls[0]?.[0].httpPath).toBe('/api/mastra/mcp/http');
    expect(startSSE.mock.calls[0]?.[0].ssePath).toBe('/api/mastra/mcp/sse');
    expect(startSSE.mock.calls[0]?.[0].messagePath).toBe('/api/mastra/mcp/message');
  });

  it('route invocation binds loopback request context values', async () => {
    const app = new FakeApp();
    const server = createServer({ enableAuth: false }, app);
    const route = {
      method: 'POST',
      path: '/agent',
      responseType: 'json',
      handler: async () => ({ created: true }),
    };

    await server.registerRoute(app as unknown as never, route as never, {});
    const entry = app.routes[0];
    expect(entry).toBeDefined();

    const req = createFakeRequest({
      method: 'POST',
      path: '/agent',
      body: { name: 'Agent One' },
      headers: { 'x-user-id': 'u-1' },
    });
    const res = new FakeResponse();
    const requestContext = new FakeRequestContext();
    requestContext.values.set(RestBindings.Http.REQUEST, req);
    requestContext.values.set(RestBindings.Http.RESPONSE, res);

    await entry?.invokeHandler(requestContext as unknown as never, []);

    expect(res.jsonBody).toEqual({ created: true });
    const requestCtxBinding = requestContext.values.get(MastraLoopbackBindings.REQUEST_CONTEXT) as Record<
      string,
      unknown
    >;
    expect(requestCtxBinding.method).toBe('POST');
    expect(requestCtxBinding.path).toBe('/agent');
    expect(requestContext.values.get(MastraLoopbackBindings.REQUEST_CONTEXT_VALUE)).toBeInstanceOf(
      MastraRequestContext,
    );
    expect(requestContext.values.get(MastraLoopbackBindings.BRIDGE)).toBeDefined();
    expect(requestContext.values.get(MastraLoopbackBindings.ABORT_SIGNAL)).toBeDefined();
  });
});
