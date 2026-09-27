/**
 * PF-4446: fetch compiler unit tests. Pure Web Request/Response — no sockets,
 * no framework apps. Shared-suite parity runs separately against the same
 * compiled handlers (see fetch-compiler.parity.test.ts).
 */
import type { Mastra } from '@mastra/core/mastra';
import { RequestContext } from '@mastra/core/request-context';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';

import { coreAuthMiddleware } from '../auth/helpers';
import { MASTRA_AUTH_MODE_KEY } from '../constants';
import { HTTPException } from '../http-exception';
import {
  FETCH_COMPILER_DEFAULT_MAX_BODY_SIZE,
  compileFetchRouteHandler,
  compileFetchRoutePattern,
  compileFetchRouter,
  type FetchCompilerDeps,
  type ServerRoute,
} from './fetch-compiler';

vi.mock('../auth/helpers', async actual => {
  const real = await actual<typeof import('../auth/helpers')>();
  return { ...real, coreAuthMiddleware: vi.fn(real.coreAuthMiddleware) };
});

vi.mock('@mastra/core/auth/ee', () => ({ hasPermission: () => false }));

const mockedCoreAuth = vi.mocked(coreAuthMiddleware);

function makeLogger() {
  return { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() };
}

function makeMastra(overrides: Record<string, unknown> = {}): { mastra: Mastra; logger: ReturnType<typeof makeLogger> } {
  const logger = makeLogger();
  const mastra = {
    getLogger: () => logger,
    getServer: () => undefined,
    getStudio: () => undefined,
    ...overrides,
  } as unknown as Mastra;
  return { mastra, logger };
}

function makeDeps(mastra: Mastra, overrides: Partial<FetchCompilerDeps> = {}): FetchCompilerDeps {
  // Unit tests mount routes without a prefix; the compiler default is '/api'.
  return { mastra, prefix: '', ...overrides };
}

function makeRoute(overrides: Record<string, any> = {}): ServerRoute {
  return {
    path: '/echo',
    method: 'POST',
    responseType: 'json',
    handler: async (params: any) => ({ ok: true }),
    ...overrides,
  } as unknown as ServerRoute;
}

function postJson(path: string, body: unknown, headers: Record<string, string> = {}): Request {
  return new Request(`http://test${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('compileFetchRoutePattern', () => {
  it('matches static paths exactly', () => {
    const pattern = compileFetchRoutePattern('/health');
    expect(pattern.match('/health')).toEqual({});
    expect(pattern.match('/health/extra')).toBeNull();
    expect(pattern.match('/other')).toBeNull();
  });

  it('extracts and decodes :param segments', () => {
    const pattern = compileFetchRoutePattern('/agents/:agentId/sessions/:sessionId');
    expect(pattern.match('/agents/a1/sessions/s2')).toEqual({ agentId: 'a1', sessionId: 's2' });
    expect(pattern.match('/agents/a%20b/sessions/s2')).toEqual({ agentId: 'a b', sessionId: 's2' });
    expect(pattern.match('/agents/a1')).toBeNull();
  });

  it('escapes regex characters in static segments', () => {
    const pattern = compileFetchRoutePattern('/v1/openapi.json');
    expect(pattern.match('/v1/openapi.json')).toEqual({});
    expect(pattern.match('/v1/openapixjson')).toBeNull();
  });
});

describe('json routes', () => {
  it('merges path, query and body params and exposes the handler context', async () => {
    const seen: Record<string, any> = {};
    const { mastra } = makeMastra();
    const route = makeRoute({
      path: '/agents/:agentId/run',
      handler: async (params: any) => {
        Object.assign(seen, params);
        return { ok: true };
      },
    });
    const handler = compileFetchRouteHandler(route, makeDeps(mastra));
    const response = await handler(
      new Request('http://test/agents/a1/run?tag=x&tag=y&n=3', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'X-Custom': 'yes' },
        body: JSON.stringify({ prompt: 'hi' }),
      }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(await response.json()).toEqual({ ok: true });
    expect(seen.agentId).toBe('a1');
    expect(seen.tag).toEqual(['x', 'y']);
    expect(seen.prompt).toBe('hi');
    expect(seen.requestContext).toBeInstanceOf(RequestContext);
    expect(seen.mastra).toBe(mastra);
    expect(seen.abortSignal).toBeInstanceOf(AbortSignal);
    expect(seen.registeredTools).toEqual({});
    expect(seen.routePrefix).toBe('');
    expect(seen.requestBody).toEqual({ prompt: 'hi' });
    expect(seen.requestPathParams).toEqual({ agentId: 'a1' });
    expect(seen.rawBody).toBeUndefined();
    expect(seen.getHeader('x-custom')).toBe('yes');
    expect(seen.getHeader('X-CUSTOM')).toBe('yes');
    expect(seen.getHeaders()['x-custom']).toBe('yes');
  });

  it('propagates an aborted request signal to the handler', async () => {
    let observed: AbortSignal | undefined;
    const { mastra } = makeMastra();
    const route = makeRoute({
      handler: async (params: any) => {
        observed = params.abortSignal;
        return { ok: true };
      },
    });
    const controller = new AbortController();
    controller.abort();
    const handler = compileFetchRouteHandler(route, makeDeps(mastra));
    await handler(new Request('http://test/echo', { method: 'POST', signal: controller.signal }));
    expect(observed?.aborted).toBe(true);
  });

  it('strips __refreshHeaders from the body and applies them as headers', async () => {
    const { mastra } = makeMastra();
    const route = makeRoute({
      handler: async () => ({ data: 1, __refreshHeaders: { 'x-refresh': 'r1' } }),
    });
    const handler = compileFetchRouteHandler(route, makeDeps(mastra));
    const response = await handler(new Request('http://test/echo', { method: 'POST' }));
    expect(await response.json()).toEqual({ data: 1 });
    expect(response.headers.get('x-refresh')).toBe('r1');
  });
});

describe('request context merge', () => {
  it('merges GET query requestContext as JSON then base64', async () => {
    let seen: RequestContext | undefined;
    const { mastra } = makeMastra();
    const route = makeRoute({
      method: 'GET',
      handler: async (params: any) => {
        seen = params.requestContext;
        return { ok: true };
      },
    });
    const handler = compileFetchRouteHandler(route, makeDeps(mastra));
    await handler(new Request('http://test/echo?requestContext=%7B%22a%22%3A1%7D', { method: 'GET' }));
    expect(seen?.get('a')).toBe(1);
    const encoded = Buffer.from(JSON.stringify({ b: 2 })).toString('base64');
    await handler(new Request(`http://test/echo?requestContext=${encoded}`, { method: 'GET' }));
    expect(seen?.get('b')).toBe(2);
  });

  it('merges POST body requestContext with query params winning conflicts', async () => {
    let seen: RequestContext | undefined;
    const { mastra } = makeMastra();
    const route = makeRoute({
      handler: async (params: any) => {
        seen = params.requestContext;
        return { ok: true };
      },
    });
    const handler = compileFetchRouteHandler(route, makeDeps(mastra));
    // Query context only merges on GET, so POST resolves body-only here.
    await handler(postJson('/echo', { requestContext: { fromBody: true } }));
    expect(seen?.get('fromBody')).toBe(true);
  });

  it('skips reserved context keys from untrusted sources', async () => {
    let seen: RequestContext | undefined;
    const { mastra } = makeMastra();
    const route = makeRoute({
      method: 'GET',
      handler: async (params: any) => {
        seen = params.requestContext;
        return { ok: true };
      },
    });
    const handler = compileFetchRouteHandler(route, makeDeps(mastra));
    const encoded = encodeURIComponent(JSON.stringify({ [MASTRA_AUTH_MODE_KEY]: 'server', safe: 1 }));
    await handler(new Request(`http://test/echo?requestContext=${encoded}`, { method: 'GET' }));
    expect(seen?.get('safe')).toBe(1);
    expect(seen?.get(MASTRA_AUTH_MODE_KEY)).toBeUndefined();
  });
});

describe('validation', () => {
  it('rejects invalid query params with the shared 400 shape', async () => {
    const { mastra } = makeMastra();
    const route = makeRoute({
      method: 'GET',
      queryParamSchema: z.object({ n: z.coerce.number() }),
      handler: async () => ({ ok: true }),
    });
    const handler = compileFetchRouteHandler(route, makeDeps(mastra));
    const response = await handler(new Request('http://test/echo?n=abc', { method: 'GET' }));
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string; issues: unknown[] };
    expect(body.error).toBe('Invalid query parameters');
    expect(Array.isArray(body.issues)).toBe(true);
  });

  it('rejects invalid bodies with the shared 400 shape', async () => {
    const { mastra } = makeMastra();
    const route = makeRoute({
      bodySchema: z.object({ name: z.string() }),
      handler: async () => ({ ok: true }),
    });
    const handler = compileFetchRouteHandler(route, makeDeps(mastra));
    const response = await handler(postJson('/echo', { name: 42 }));
    expect(response.status).toBe(400);
    expect(((await response.json()) as { error: string }).error).toBe('Invalid request body');
  });

  it('rejects invalid path params with the shared 400 shape', async () => {
    const { mastra } = makeMastra();
    const route = makeRoute({
      path: '/items/:id',
      pathParamSchema: z.object({ id: z.coerce.number() }),
      handler: async () => ({ ok: true }),
    });
    const handler = compileFetchRouteHandler(route, makeDeps(mastra));
    const response = await handler(new Request('http://test/items/abc', { method: 'POST' }));
    expect(response.status).toBe(400);
    expect(((await response.json()) as { error: string }).error).toBe('Invalid path parameters');
  });

  it('honors route onValidationError hooks', async () => {
    const { mastra } = makeMastra();
    const route = makeRoute({
      bodySchema: z.object({ name: z.string() }),
      onValidationError: (() => ({ status: 422, body: { error: 'custom' } })) as any,
      handler: async () => ({ ok: true }),
    });
    const handler = compileFetchRouteHandler(route, makeDeps(mastra));
    const response = await handler(postJson('/echo', { name: 42 }));
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ error: 'custom' });
  });
});

describe('body parsing', () => {
  it('leaves empty JSON bodies undefined', async () => {
    let seenBody: unknown = 'unset';
    const { mastra } = makeMastra();
    const route = makeRoute({
      handler: async (params: any) => {
        seenBody = params.requestBody;
        return { ok: true };
      },
    });
    const handler = compileFetchRouteHandler(route, makeDeps(mastra));
    await handler(new Request('http://test/echo', { method: 'POST', headers: { 'content-type': 'application/json' } }));
    expect(seenBody).toBeUndefined();
  });

  it('maps malformed JSON to the 400 body shape without calling the handler', async () => {
    const { mastra } = makeMastra();
    const handlerFn = vi.fn(async () => ({ ok: true }));
    const route = makeRoute({ handler: handlerFn });
    const handler = compileFetchRouteHandler(route, makeDeps(mastra));
    const response = await handler(
      new Request('http://test/echo', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{oops',
      }),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: 'Invalid request body' });
    expect(handlerFn).not.toHaveBeenCalled();
  });

  it('leaves unknown content types unparsed (Hono parity, no 415)', async () => {
    let seenBody: unknown = 'unset';
    const { mastra } = makeMastra();
    const route = makeRoute({
      handler: async (params: any) => {
        seenBody = params.requestBody;
        return { ok: true };
      },
    });
    const handler = compileFetchRouteHandler(route, makeDeps(mastra));
    const response = await handler(
      new Request('http://test/echo', {
        method: 'POST',
        headers: { 'content-type': 'text/plain' },
        body: 'hello',
      }),
    );
    expect(response.status).toBe(200);
    expect(seenBody).toBeUndefined();
  });

  it('parses multipart form data with File-to-Buffer semantics', async () => {
    let seenBody: any;
    const { mastra } = makeMastra();
    const route = makeRoute({
      handler: async (params: any) => {
        seenBody = params.requestBody;
        return { ok: true };
      },
    });
    const handler = compileFetchRouteHandler(route, makeDeps(mastra));
    const form = new FormData();
    form.append('file', new File(['abc'], 'a.txt', { type: 'text/plain' }));
    form.append('meta', JSON.stringify({ n: 1 }));
    form.append('raw', 'plain');
    const response = await handler(new Request('http://test/echo', { method: 'POST', body: form }));
    expect(response.status).toBe(200);
    expect(Buffer.isBuffer(seenBody.file)).toBe(true);
    expect(seenBody.file.toString()).toBe('abc');
    expect(seenBody.meta).toEqual({ n: 1 });
    expect(seenBody.raw).toBe('plain');
  });
});

describe('body limits', () => {
  it('rejects over-limit bodies with 413 before handler execution', async () => {
    const { mastra } = makeMastra();
    const handlerFn = vi.fn(async () => ({ ok: true }));
    const route = makeRoute({ maxBodySize: 16, handler: handlerFn });
    const handler = compileFetchRouteHandler(route, makeDeps(mastra));
    const response = await handler(postJson('/echo', { pad: 'x'.repeat(64) }));
    expect(response.status).toBe(413);
    expect(handlerFn).not.toHaveBeenCalled();
  });

  it('rejects over-limit bodies without Content-Length mid-stream', async () => {
    const { mastra } = makeMastra();
    const handlerFn = vi.fn(async () => ({ ok: true }));
    const route = makeRoute({ maxBodySize: 16, handler: handlerFn });
    const handler = compileFetchRouteHandler(route, makeDeps(mastra));
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"pad":"'));
        controller.enqueue(new TextEncoder().encode('x'.repeat(64)));
        controller.enqueue(new TextEncoder().encode('"}'));
        controller.close();
      },
    });
    const response = await handler(
      new Request('http://test/echo', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: stream,
        duplex: 'half',
      } as RequestInit),
    );
    expect(response.status).toBe(413);
    expect(handlerFn).not.toHaveBeenCalled();
  });

  it('captures rawBody for skipBodyParse routes while still enforcing the cap', async () => {
    let seen: any = {};
    const { mastra } = makeMastra();
    const route = makeRoute({
      skipBodyParse: true,
      handler: async (params: any) => {
        seen = { rawBody: params.rawBody, requestBody: params.requestBody };
        return { ok: true };
      },
    });
    const handler = compileFetchRouteHandler(route, makeDeps(mastra));
    const response = await handler(postJson('/echo', { a: 1 }));
    expect(response.status).toBe(200);
    expect(seen.requestBody).toBeUndefined();
    expect(new TextDecoder().decode(seen.rawBody)).toBe(JSON.stringify({ a: 1 }));

    const capped = compileFetchRouteHandler(makeRoute({ skipBodyParse: true, maxBodySize: 4 }), makeDeps(mastra));
    const cappedResponse = await capped(postJson('/echo', { a: 1 }));
    expect(cappedResponse.status).toBe(413);
  });

  it('defaults to the 1 MiB cap', () => {
    expect(FETCH_COMPILER_DEFAULT_MAX_BODY_SIZE).toBe(1024 * 1024);
  });
});

describe('auth translation', () => {
  it('passes requests through when no auth is configured', async () => {
    const { mastra } = makeMastra();
    const route = makeRoute({ handler: async () => ({ ok: true }) });
    const handler = compileFetchRouteHandler(route, makeDeps(mastra));
    const response = await handler(new Request('http://test/echo', { method: 'POST' }));
    expect(response.status).toBe(200);
    expect(mockedCoreAuth).not.toHaveBeenCalled();
  });

  it('skips core auth for explicit custom-route opt-outs', async () => {
    const { mastra } = makeMastra({
      getServer: () => ({ auth: { authenticateToken: async () => ({}) } }),
    });
    const route = makeRoute({ requiresAuth: false, handler: async () => ({ ok: true }) });
    const handler = compileFetchRouteHandler(
      route,
      makeDeps(mastra, { customRouteAuthConfig: new Map([['/echo', false]]) }),
    );
    const response = await handler(new Request('http://test/echo', { method: 'POST' }));
    expect(response.status).toBe(200);
    expect(mockedCoreAuth).not.toHaveBeenCalled();
  });

  it('translates core auth errors to 401 with headers', async () => {
    const { mastra } = makeMastra({
      getServer: () => ({ auth: { authenticateToken: async () => ({}) } }),
    });
    mockedCoreAuth.mockResolvedValueOnce({
      action: 'error',
      status: 401,
      body: { error: 'nope' },
      headers: { 'x-a': 'b' },
    });
    const route = makeRoute({ handler: async () => ({ ok: true }) });
    const handler = compileFetchRouteHandler(route, makeDeps(mastra));
    const response = await handler(new Request('http://test/echo', { method: 'POST' }));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'nope' });
    expect(response.headers.get('x-a')).toBe('b');
  });

  it('carries success headers onto later error responses', async () => {
    const { mastra } = makeMastra({
      getServer: () => ({ auth: { authenticateToken: async () => ({}) } }),
    });
    mockedCoreAuth.mockResolvedValueOnce({ action: 'next', headers: { 'x-auth': 'yes' } });
    const route = makeRoute({
      bodySchema: z.object({ name: z.string() }),
      handler: async () => ({ ok: true }),
    });
    const handler = compileFetchRouteHandler(route, makeDeps(mastra));
    const response = await handler(postJson('/echo', { name: 42 }));
    expect(response.status).toBe(400);
    expect(response.headers.get('x-auth')).toBe('yes');
  });
});

describe('permission checks', () => {
  it('denies without the required permission when an RBAC provider is present', async () => {
    const { mastra } = makeMastra({
      getServer: () => ({ auth: { authenticateToken: async () => ({}) }, rbac: {} }),
    });
    mockedCoreAuth.mockResolvedValue({ action: 'next' });
    const route = makeRoute({
      requiresPermission: 'agents:write',
      handler: async () => ({ ok: true }),
    });
    const handler = compileFetchRouteHandler(route, makeDeps(mastra));
    const response = await handler(new Request('http://test/echo', { method: 'POST' }));
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: 'Forbidden',
      message: 'Missing required permission: agents:write',
    });
  });

  it('skips permission checks without an RBAC provider', async () => {
    const { mastra } = makeMastra({
      getServer: () => ({ auth: { authenticateToken: async () => ({}) } }),
    });
    mockedCoreAuth.mockResolvedValue({ action: 'next' });
    const route = makeRoute({
      requiresPermission: 'agents:write',
      handler: async () => ({ ok: true }),
    });
    const handler = compileFetchRouteHandler(route, makeDeps(mastra));
    const response = await handler(new Request('http://test/echo', { method: 'POST' }));
    expect(response.status).toBe(200);
  });
});

describe('stream responses', () => {
  function sseRoute(overrides: Record<string, any> = {}) {
    return makeRoute({
      responseType: 'stream',
      streamFormat: 'sse',
      handler: async () => ({
        fullStream: new ReadableStream({
          start(controller) {
            controller.enqueue({ type: 'text', text: 'a' });
            controller.enqueue({ type: 'text', text: 'b' });
            controller.close();
          },
        }),
      }),
      ...overrides,
    });
  }

  it('frames chunks as SSE with stream headers', async () => {
    const { mastra } = makeMastra();
    const handler = compileFetchRouteHandler(sseRoute(), makeDeps(mastra));
    const response = await handler(new Request('http://test/echo', { method: 'POST' }));
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/event-stream');
    expect(response.headers.get('cache-control')).toBe('no-cache');
    expect(response.headers.get('x-accel-buffering')).toBe('no');
    expect(response.headers.get('transfer-encoding')).toBeNull();
    expect(await response.text()).toBe(
      'data: {"type":"text","text":"a"}\n\ndata: {"type":"text","text":"b"}\n\n',
    );
  });

  it('prefixes the flush marker when sseFlushOnConnect is set', async () => {
    const { mastra } = makeMastra();
    const handler = compileFetchRouteHandler(sseRoute({ sseFlushOnConnect: true }), makeDeps(mastra));
    const response = await handler(new Request('http://test/echo', { method: 'POST' }));
    const text = await response.text();
    expect(text.startsWith(': connected\n\n')).toBe(true);
  });

  it('frames raw streams with the record separator', async () => {
    const { mastra } = makeMastra();
    const handler = compileFetchRouteHandler(sseRoute({ streamFormat: 'stream' }), makeDeps(mastra));
    const response = await handler(new Request('http://test/echo', { method: 'POST' }));
    expect(response.headers.get('content-type')).toBe('text/plain');
    expect(await response.text()).toBe('{"type":"text","text":"a"}\u001e{"type":"text","text":"b"}\u001e');
  });

  it('skips chunks both serializers reject and logs once per chunk', async () => {
    const { mastra, logger } = makeMastra();
    const throwing = {
      get boom(): string {
        throw new Error('bad getter');
      },
    };
    const handler = compileFetchRouteHandler(
      sseRoute({
        handler: async () => ({
          fullStream: new ReadableStream({
            start(controller) {
              controller.enqueue({ ok: 1 });
              controller.enqueue(throwing);
              controller.enqueue(null);
              controller.close();
            },
          }),
        }),
      }),
      makeDeps(mastra),
    );
    const response = await handler(new Request('http://test/echo', { method: 'POST' }));
    expect(await response.text()).toBe('data: {"ok":1}\n\n');
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(
      'Failed to serialize stream chunk, skipping',
      expect.objectContaining({ path: '/echo' }),
    );
  });

  it('passes :-prefixed string chunks through on SSE lanes', async () => {
    const { mastra } = makeMastra();
    const handler = compileFetchRouteHandler(
      sseRoute({
        handler: async () => ({
          fullStream: new ReadableStream({
            start(controller) {
              controller.enqueue(': papersflow-keep-alive\n\n');
              controller.close();
            },
          }),
        }),
      }),
      makeDeps(mastra),
    );
    const response = await handler(new Request('http://test/echo', { method: 'POST' }));
    expect(await response.text()).toBe(': papersflow-keep-alive\n\n');
  });

  it('redacts request payloads from finish chunks by default, preserved on opt-out', async () => {
    const { mastra } = makeMastra();
    const chunk = () => ({
      type: 'finish',
      payload: { metadata: { request: { secret: 1 }, step: 'x' } },
    });
    const streamRoute = () =>
      sseRoute({
        handler: async () => ({
          fullStream: new ReadableStream({
            start(controller) {
              controller.enqueue(chunk());
              controller.close();
            },
          }),
        }),
      });
    const redacted = await compileFetchRouteHandler(streamRoute(), makeDeps(mastra))(
      new Request('http://test/echo', { method: 'POST' }),
    );
    expect(await redacted.text()).toBe('data: {"type":"finish","payload":{"metadata":{"step":"x"}}}\n\n');

    const raw = await compileFetchRouteHandler(streamRoute(), makeDeps(mastra, { redact: false }))(
      new Request('http://test/echo', { method: 'POST' }),
    );
    expect(await raw.text()).toBe(
      'data: {"type":"finish","payload":{"metadata":{"request":{"secret":1},"step":"x"}}}\n\n',
    );
  });

  it('propagates reader cancel to the source stream', async () => {
    let cancelled = false;
    const { mastra } = makeMastra();
    const handler = compileFetchRouteHandler(
      sseRoute({
        handler: async () => ({
          fullStream: new ReadableStream({
            start(controller) {
              controller.enqueue({ n: 1 });
            },
            cancel() {
              cancelled = true;
            },
          }),
        }),
      }),
      makeDeps(mastra),
    );
    const response = await handler(new Request('http://test/echo', { method: 'POST' }));
    const body = response.body;
    if (!body) throw new Error('expected a streamed response body');
    const reader = body.getReader();
    await reader.read();
    await reader.cancel();
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(cancelled).toBe(true);
  });
});

describe('datastream responses', () => {
  it('passes AI SDK responses through minus framing headers', async () => {
    const { mastra } = makeMastra();
    const route = makeRoute({
      responseType: 'datastream-response',
      handler: async () =>
        new Response('stream-bytes', {
          status: 200,
          headers: { 'content-type': 'text/plain', 'x-vercel-ai-ui-message-stream': 'v1' },
        }),
    });
    const handler = compileFetchRouteHandler(route, makeDeps(mastra));
    const response = await handler(new Request('http://test/echo', { method: 'POST' }));
    expect(response.status).toBe(200);
    expect(response.headers.get('x-vercel-ai-ui-message-stream')).toBe('v1');
    expect(await response.text()).toBe('stream-bytes');
  });
});

describe('thrown errors', () => {
  it('passes through HTTPException custom responses', async () => {
    const { mastra } = makeMastra();
    const route = makeRoute({
      handler: async () => {
        throw new HTTPException(418, { res: new Response('teapot', { status: 418 }) });
      },
    });
    const handler = compileFetchRouteHandler(route, makeDeps(mastra));
    const response = await handler(new Request('http://test/echo', { method: 'POST' }));
    expect(response.status).toBe(418);
    expect(await response.text()).toBe('teapot');
  });

  it('maps status-carrying errors and falls back to 500', async () => {
    const { mastra } = makeMastra();
    const statusRoute = makeRoute({
      handler: async () => {
        throw Object.assign(new Error('gone'), { status: 410 });
      },
    });
    const statusHandler = compileFetchRouteHandler(statusRoute, makeDeps(mastra));
    const statusResponse = await statusHandler(new Request('http://test/echo', { method: 'POST' }));
    expect(statusResponse.status).toBe(410);
    expect(await statusResponse.json()).toEqual({ error: 'gone' });

    const genericRoute = makeRoute({
      handler: async () => {
        throw new Error('boom');
      },
    });
    const genericHandler = compileFetchRouteHandler(genericRoute, makeDeps(mastra));
    const genericResponse = await genericHandler(new Request('http://test/echo', { method: 'POST' }));
    expect(genericResponse.status).toBe(500);
    expect(await genericResponse.json()).toEqual({ error: 'boom' });
  });
});

describe('unsupported response types', () => {
  it.each(['mcp-http', 'mcp-sse'] as const)('answers %s with an explicit 501', async responseType => {
    const { mastra } = makeMastra();
    const route = makeRoute({ responseType, handler: async () => ({}) });
    const handler = compileFetchRouteHandler(route, makeDeps(mastra));
    const response = await handler(new Request('http://test/echo', { method: 'POST' }));
    expect(response.status).toBe(501);
    expect(((await response.json()) as { error: string }).error).toContain('fetch compiler');
  });
});

describe('compileFetchRouter', () => {
  it('dispatches by method and pattern with prefix stripping', async () => {
    const { mastra } = makeMastra();
    const router = compileFetchRouter(
      [
        makeRoute({ path: '/agents/:agentId/run', method: 'POST', handler: async (p: any) => ({ agent: p.agentId }) }),
        makeRoute({ path: '/health', method: 'GET', handler: async () => ({ ok: true }) }),
      ],
      makeDeps(mastra, { prefix: '/api' }),
    );
    const hit = await router.fetch(new Request('http://test/api/agents/a9/run', { method: 'POST' }));
    expect(await hit.json()).toEqual({ agent: 'a9' });
    const health = await router.fetch(new Request('http://test/api/health', { method: 'GET' }));
    expect(health.status).toBe(200);
    const wrongMethod = await router.fetch(new Request('http://test/api/health', { method: 'POST' }));
    expect(wrongMethod.status).toBe(404);
    const outsidePrefix = await router.fetch(new Request('http://test/other/health', { method: 'GET' }));
    expect(outsidePrefix.status).toBe(404);
  });

  it('answers unknown routes with the Fastify-compatible 404 shape by default', async () => {
    const { mastra } = makeMastra();
    const router = compileFetchRouter([], makeDeps(mastra));
    const response = await router.fetch(new Request('http://test/nope', { method: 'GET' }));
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      message: 'Route GET:/nope not found',
      error: 'Not Found',
      statusCode: 404,
    });
  });

  it('honors onUnknownRoute overrides', async () => {
    const { mastra } = makeMastra();
    const router = compileFetchRouter(
      [],
      makeDeps(mastra, { onUnknownRoute: () => Response.json({ error: 'custom' }, { status: 404 }) }),
    );
    const response = await router.fetch(new Request('http://test/nope', { method: 'GET' }));
    expect(await response.json()).toEqual({ error: 'custom' });
  });

  it('expands ALL routes to the five methods without duplicates', async () => {
    const { mastra } = makeMastra();
    const router = compileFetchRouter(
      [makeRoute({ path: '/ping', method: 'ALL', handler: async () => ({ ok: true }) })],
      makeDeps(mastra),
    );
    expect(router.routes).toHaveLength(5);
    for (const method of ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']) {
      const response = await router.fetch(new Request('http://test/ping', { method }));
      expect(response.status).toBe(200);
    }
  });

  it('exposes the route snapshot as serverRoutes by default', async () => {
    let seen: unknown;
    const { mastra } = makeMastra();
    const router = compileFetchRouter(
      [makeRoute({ handler: async (p: any) => ((seen = p.serverRoutes), { ok: true }) })],
      makeDeps(mastra),
    );
    await router.fetch(new Request('http://test/echo', { method: 'POST' }));
    expect(Array.isArray(seen)).toBe(true);
    expect((seen as unknown[]).length).toBe(1);
  });
});
