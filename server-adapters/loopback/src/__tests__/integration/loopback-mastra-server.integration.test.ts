import { Context } from '@loopback/core';
import { Mastra } from '@mastra/core';
import { registerApiRoute } from '@mastra/core/server';
import { describe, expect, it, vi } from 'vitest';

import { MastraLoopbackProviderBindings } from '../../bindings.js';
import { LoopbackMastraServer } from '../../loopback-mastra-server.js';
import {
  FakeResponse,
  createAppWithCapture,
  createFakeRequest,
  getWrittenText,
  invokeRoute,
} from '../support/fakes.js';

class CustomerService {
  findById(id: string): { id: string; name: string } {
    return { id, name: `customer-${id}` };
  }
}

describe('LoopbackMastraServer integration', () => {
  it('resolves LoopBack bindings and provider-backed request state from Mastra requestContext', async () => {
    const mastra = new Mastra();
    const { app, routes } = createAppWithCapture();
    app.bind('services.CustomerService').to(new CustomerService());

    const adapter = new LoopbackMastraServer({
      app,
      mastra,
      config: {
        prefix: '/api/mastra',
        enableAuth: false,
      },
    });

    await adapter.registerRoute(
      app,
      {
        method: 'GET',
        path: '/customers/:id',
        responseType: 'json',
        handler: async ({
          params,
          requestContext,
        }: {
          params: Record<string, string>;
          requestContext: { get: (key: string) => unknown };
        }) => {
          const loopback = requestContext.get('loopback') as {
            resolve: <T = unknown>(binding: unknown) => Promise<T>;
          };
          const customerService = await loopback.resolve<CustomerService>('services.CustomerService');
          const providerRequestContext = await loopback.resolve<{
            get: (key: string) => unknown;
          }>(MastraLoopbackProviderBindings.REQUEST_CONTEXT);
          const providerBridge = await loopback.resolve<{
            resolve: <T = unknown>(binding: unknown) => Promise<T>;
          }>(MastraLoopbackProviderBindings.BRIDGE);

          return {
            customer: customerService.findById(params.id),
            tenantId: requestContext.get('tenantId'),
            providerTenantId: providerRequestContext?.get('tenantId'),
            providerCanResolveService: !!providerBridge,
          };
        },
      } as never,
      { prefix: '/api/mastra' },
    );

    const entry = routes.find(route => route.path === '/api/mastra/customers/{id}');
    expect(entry).toBeDefined();

    const request = createFakeRequest({
      path: '/api/mastra/customers/42',
      originalUrl: '/api/mastra/customers/42?requestContext=%7B%22tenantId%22%3A%22tenant-acme%22%7D',
      url: '/api/mastra/customers/42?requestContext=%7B%22tenantId%22%3A%22tenant-acme%22%7D',
      params: { id: '42' },
      query: {
        requestContext: JSON.stringify({ tenantId: 'tenant-acme' }),
      },
    });
    const response = new FakeResponse();

    await invokeRoute(app, entry!, request, response);

    expect(response.jsonBody).toEqual({
      customer: { id: '42', name: 'customer-42' },
      tenantId: 'tenant-acme',
      providerTenantId: 'tenant-acme',
      providerCanResolveService: true,
    });
  });

  it('registers and serves Mastra custom API routes through LoopBack route entries', async () => {
    const mastra = new Mastra();
    mastra.setServer({
      apiRoutes: [
        registerApiRoute('/customer/:id', {
          method: 'GET',
          handler: async c => {
            const requestContext = c.get('requestContext');
            const loopback = requestContext.get('loopback') as {
              resolve: (binding: string) => Promise<CustomerService>;
            };
            const customerService = await loopback.resolve('services.CustomerService');
            return c.json({
              customer: customerService.findById(c.req.param('id')),
              hasLoopbackBridge: requestContext.has('loopback'),
            });
          },
        }),
      ],
    });

    const { app, routes } = createAppWithCapture();
    app.bind('services.CustomerService').to(new CustomerService());

    const adapter = new LoopbackMastraServer({
      app,
      mastra,
      config: {
        prefix: '/api/mastra',
        enableAuth: false,
      },
    });

    await adapter.init();

    const entry = routes.find(route => route.path === '/api/mastra/customer/{id}');
    expect(entry).toBeDefined();

    const request = createFakeRequest({
      path: '/api/mastra/customer/7',
      originalUrl: '/api/mastra/customer/7',
      url: '/api/mastra/customer/7',
      params: { id: '7' },
    });
    const response = new FakeResponse();

    await invokeRoute(app, entry!, request, response);

    expect(response.statusCode).toBe(200);
    expect(response.getHeader('content-type')).toBe('application/json');
    expect(response.sendBody).toBeUndefined();
    expect(response.writes.length).toBeGreaterThan(0);
    expect(Buffer.from(response.writes[0] as Uint8Array).toString('utf8')).toContain(
      '{"customer":{"id":"7","name":"customer-7"},"hasLoopbackBridge":true}',
    );
  });

  it('streams SSE responses through a real LoopBack route entry', async () => {
    const mastra = new Mastra();
    const { app, routes } = createAppWithCapture();
    const adapter = new LoopbackMastraServer({
      app,
      mastra,
      config: { prefix: '/api/mastra', enableAuth: false },
    });

    await adapter.registerRoute(
      app,
      {
        method: 'GET',
        path: '/events',
        responseType: 'stream',
        streamFormat: 'sse',
        handler: async () => {
          async function* chunks() {
            yield 'hello';
            yield { delta: 'world' };
          }
          return chunks();
        },
      } as never,
      { prefix: '/api/mastra' },
    );

    const entry = routes.find(route => route.path === '/api/mastra/events');
    expect(entry).toBeDefined();

    const response = new FakeResponse();
    await invokeRoute(
      app,
      entry!,
      createFakeRequest({
        path: '/api/mastra/events',
        originalUrl: '/api/mastra/events',
        url: '/api/mastra/events',
      }),
      response,
    );

    expect(response.flushed).toBe(true);
    expect(response.getHeader('content-type')).toBe('text/event-stream');
    expect(getWrittenText(response)).toContain('data: hello');
    expect(getWrittenText(response)).toContain('event: done');
  });

  it('handles datastream-response through a LoopBack route entry', async () => {
    const mastra = new Mastra();
    const { app, routes } = createAppWithCapture();
    const adapter = new LoopbackMastraServer({
      app,
      mastra,
      config: { prefix: '/api/mastra', enableAuth: false },
    });
    const encoder = new TextEncoder();

    await adapter.registerRoute(
      app,
      {
        method: 'GET',
        path: '/data-stream',
        responseType: 'datastream-response',
        handler: async () => ({
          status: 206,
          headers: new Headers({ 'x-stream': 'true' }),
          body: new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(encoder.encode('part-1'));
              controller.enqueue(encoder.encode('part-2'));
              controller.close();
            },
          }),
        }),
      } as never,
      { prefix: '/api/mastra' },
    );

    const entry = routes.find(route => route.path === '/api/mastra/data-stream');
    expect(entry).toBeDefined();

    const response = new FakeResponse();
    await invokeRoute(
      app,
      entry!,
      createFakeRequest({
        path: '/api/mastra/data-stream',
        originalUrl: '/api/mastra/data-stream',
        url: '/api/mastra/data-stream',
      }),
      response,
    );

    expect(response.statusCode).toBe(206);
    expect(response.getHeader('x-stream')).toBe('true');
    expect(getWrittenText(response)).toContain('part-1part-2');
  });

  it('delegates mcp-http and mcp-sse through registered LoopBack routes', async () => {
    const mastra = new Mastra();
    const { app, routes } = createAppWithCapture();
    const adapter = new LoopbackMastraServer({
      app,
      mastra,
      config: { prefix: '/api/mastra', enableAuth: false },
    });
    const startHTTP = vi.fn(async () => undefined);
    const startSSE = vi.fn(async () => undefined);

    await adapter.registerRoute(
      app,
      {
        method: 'POST',
        path: '/mcp-http',
        responseType: 'mcp-http',
        handler: async () => ({
          server: { startHTTP },
          httpPath: '/transport',
          mcpOptions: { mode: 'http' },
        }),
      } as never,
      { prefix: '/api/mastra' },
    );
    await adapter.registerRoute(
      app,
      {
        method: 'GET',
        path: '/mcp-sse',
        responseType: 'mcp-sse',
        handler: async () => ({
          server: { startSSE },
          ssePath: '/events',
          messagePath: '/messages',
          mcpOptions: { mode: 'sse' },
        }),
      } as never,
      { prefix: '/api/mastra' },
    );

    const httpEntry = routes.find(route => route.path === '/api/mastra/mcp-http');
    const sseEntry = routes.find(route => route.path === '/api/mastra/mcp-sse');
    expect(httpEntry).toBeDefined();
    expect(sseEntry).toBeDefined();

    await invokeRoute(
      app,
      httpEntry!,
      createFakeRequest({
        method: 'POST',
        path: '/api/mastra/mcp-http',
        originalUrl: '/api/mastra/mcp-http',
        url: '/api/mastra/mcp-http',
      }),
      new FakeResponse(),
    );
    await invokeRoute(
      app,
      sseEntry!,
      createFakeRequest({
        method: 'GET',
        path: '/api/mastra/mcp-sse',
        originalUrl: '/api/mastra/mcp-sse',
        url: '/api/mastra/mcp-sse',
      }),
      new FakeResponse(),
    );

    expect(startHTTP).toHaveBeenCalledTimes(1);
    expect(startSSE).toHaveBeenCalledTimes(1);
    expect(startHTTP.mock.calls[0]?.[0].httpPath).toBe('/api/mastra/transport');
    expect(startSSE.mock.calls[0]?.[0].ssePath).toBe('/api/mastra/events');
    expect(startSSE.mock.calls[0]?.[0].messagePath).toBe('/api/mastra/messages');
  });

  it('aborts in-flight handlers when the client disconnects', async () => {
    const mastra = new Mastra();
    const { app, routes } = createAppWithCapture();
    const adapter = new LoopbackMastraServer({
      app,
      mastra,
      config: { prefix: '/api/mastra', enableAuth: false },
    });
    let markReady: (() => void) | undefined;
    const ready = new Promise<void>(resolve => {
      markReady = resolve;
    });

    await adapter.registerRoute(
      app,
      {
        method: 'GET',
        path: '/abortable',
        responseType: 'json',
        handler: async ({ abortSignal }: { abortSignal: AbortSignal }) => {
          markReady?.();
          await new Promise<void>(resolve => {
            abortSignal.addEventListener('abort', () => resolve(), { once: true });
          });
          return { aborted: abortSignal.aborted };
        },
      } as never,
      { prefix: '/api/mastra' },
    );

    const entry = routes.find(route => route.path === '/api/mastra/abortable');
    expect(entry).toBeDefined();

    const request = createFakeRequest({
      path: '/api/mastra/abortable',
      originalUrl: '/api/mastra/abortable',
      url: '/api/mastra/abortable',
    });
    const response = new FakeResponse();
    const requestContext = new Context(app);
    requestContext.bind('rest.http.request').to(request as never);
    requestContext.bind('rest.http.response').to(response as never);

    const invokePromise = entry!.invokeHandler(requestContext as never, []);
    await ready;
    request.emit('aborted');
    await invokePromise;

    expect(response.jsonBody).toEqual({ aborted: true });
  });

  it('logs requests with Mastra build.apiReqLogs config', async () => {
    const mastra = new Mastra();
    mastra.setServer({
      build: {
        apiReqLogs: {
          enabled: true,
          level: 'info',
          includeHeaders: true,
          includeQueryParams: true,
          redactHeaders: ['authorization'],
        },
      },
    });

    const { app, routes } = createAppWithCapture();
    const adapter = new LoopbackMastraServer({
      app,
      mastra,
      config: {
        prefix: '/api/mastra',
        enableAuth: false,
      },
    });

    await adapter.registerRoute(
      app,
      {
        method: 'GET',
        path: '/ping',
        responseType: 'json',
        handler: async () => ({ ok: true }),
      } as never,
      { prefix: '/api/mastra' },
    );

    const entry = routes.find(route => route.path === '/api/mastra/ping');
    expect(entry).toBeDefined();

    const request = createFakeRequest({
      path: '/api/mastra/ping',
      originalUrl: '/api/mastra/ping?foo=bar',
      url: '/api/mastra/ping?foo=bar',
      headers: {
        authorization: 'Bearer secret-token',
        'x-request-id': 'req-1',
      },
      query: {
        foo: 'bar',
      },
    });
    const response = new FakeResponse();
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);

    await invokeRoute(app, entry!, request, response);

    expect(response.statusCode).toBe(200);
    expect(infoSpy).toHaveBeenCalledTimes(1);
    const [, payload] = infoSpy.mock.calls[0] ?? [];
    expect(payload).toMatchObject({
      method: 'GET',
      path: '/api/mastra/ping',
      status: 200,
      query: { foo: 'bar' },
      headers: {
        authorization: '[REDACTED]',
        'x-request-id': 'req-1',
      },
    });
  });

  it('applies Mastra auth config to standard and custom LoopBack routes', async () => {
    const mastra = new Mastra();
    mastra.setServer({
      auth: {
        protected: ['/api/mastra/secure/*', '/api/mastra/customer/*'],
        authenticateToken: async token => {
          if (token === 'valid-token') {
            return { id: 'user-1' };
          }
          return null;
        },
      },
      apiRoutes: [
        registerApiRoute('/customer/:id', {
          method: 'GET',
          handler: async c => {
            const requestContext = c.get('requestContext');
            const user = requestContext.get('user') as { id: string };
            return c.json({
              customerId: c.req.param('id'),
              userId: user.id,
            });
          },
          requiresAuth: true,
        }),
      ],
    });

    const { app, routes } = createAppWithCapture();
    const adapter = new LoopbackMastraServer({
      app,
      mastra,
      config: {
        prefix: '/api/mastra',
      },
    });

    await adapter.registerRoute(
      app,
      {
        method: 'GET',
        path: '/secure/:id',
        responseType: 'json',
        handler: async ({
          requestContext,
          params,
        }: {
          requestContext: { get: (key: string) => unknown };
          params: Record<string, string>;
        }) => {
          const user = requestContext.get('user') as { id: string };
          return {
            secureId: params.id,
            userId: user.id,
          };
        },
      } as never,
      { prefix: '/api/mastra' },
    );
    await adapter.registerCustomApiRoutes();

    const secureEntry = routes.find(route => route.path === '/api/mastra/secure/{id}');
    const customEntry = routes.find(route => route.path === '/api/mastra/customer/{id}');
    expect(secureEntry).toBeDefined();
    expect(customEntry).toBeDefined();

    const unauthorizedSecureResponse = new FakeResponse();
    await invokeRoute(
      app,
      secureEntry!,
      createFakeRequest({
        path: '/api/mastra/secure/11',
        originalUrl: '/api/mastra/secure/11',
        url: '/api/mastra/secure/11',
        params: { id: '11' },
      }),
      unauthorizedSecureResponse,
    );
    expect(unauthorizedSecureResponse.statusCode).toBe(401);
    expect(unauthorizedSecureResponse.jsonBody).toEqual({ error: 'Invalid or expired token' });

    const authorizedSecureResponse = new FakeResponse();
    await invokeRoute(
      app,
      secureEntry!,
      createFakeRequest({
        path: '/api/mastra/secure/11',
        originalUrl: '/api/mastra/secure/11',
        url: '/api/mastra/secure/11',
        params: { id: '11' },
        headers: { authorization: 'Bearer valid-token' },
      }),
      authorizedSecureResponse,
    );
    expect(authorizedSecureResponse.statusCode).toBe(200);
    expect(authorizedSecureResponse.jsonBody).toEqual({
      secureId: '11',
      userId: 'user-1',
    });

    const unauthorizedCustomResponse = new FakeResponse();
    await invokeRoute(
      app,
      customEntry!,
      createFakeRequest({
        path: '/api/mastra/customer/55',
        originalUrl: '/api/mastra/customer/55',
        url: '/api/mastra/customer/55',
        params: { id: '55' },
      }),
      unauthorizedCustomResponse,
    );
    expect(unauthorizedCustomResponse.statusCode).toBe(401);
    expect(unauthorizedCustomResponse.jsonBody).toEqual({ error: 'Invalid or expired token' });

    const authorizedCustomResponse = new FakeResponse();
    await invokeRoute(
      app,
      customEntry!,
      createFakeRequest({
        path: '/api/mastra/customer/55',
        originalUrl: '/api/mastra/customer/55',
        url: '/api/mastra/customer/55',
        params: { id: '55' },
        headers: { authorization: 'Bearer valid-token' },
      }),
      authorizedCustomResponse,
    );
    expect(authorizedCustomResponse.statusCode).toBe(200);
    expect(Buffer.from(authorizedCustomResponse.writes[0] as Uint8Array).toString('utf8')).toContain(
      '{"customerId":"55","userId":"user-1"}',
    );
  });

  it('allows consumers to replace the built-in auth strategy and resolve custom auth context', async () => {
    const mastra = new Mastra();
    const { app, routes } = createAppWithCapture();
    const adapter = new LoopbackMastraServer({
      app,
      mastra,
      config: {
        prefix: '/api/mastra',
        auth: {
          authorizeMode: 'replace',
          authorize: async input => {
            return input.getHeader('x-api-key') === 'loopback-secret' ? null : { status: 403, error: 'Forbidden' };
          },
          resolveContextMode: 'replace',
          resolveContext: async input => ({
            userId: input.headers['x-user-id'] as string | undefined,
            raw: { strategy: 'custom' },
          }),
        },
      },
    });

    await adapter.registerRoute(
      app,
      {
        method: 'GET',
        path: '/custom-auth',
        responseType: 'json',
        handler: async ({ requestContext }: { requestContext: { get: (key: string) => unknown } }) => ({
          auth: requestContext.get('auth'),
        }),
      } as never,
      { prefix: '/api/mastra' },
    );

    const entry = routes.find(route => route.path === '/api/mastra/custom-auth');
    expect(entry).toBeDefined();

    const unauthorizedResponse = new FakeResponse();
    await invokeRoute(
      app,
      entry!,
      createFakeRequest({
        path: '/api/mastra/custom-auth',
        originalUrl: '/api/mastra/custom-auth',
        url: '/api/mastra/custom-auth',
      }),
      unauthorizedResponse,
    );
    expect(unauthorizedResponse.statusCode).toBe(403);
    expect(unauthorizedResponse.jsonBody).toEqual({ error: 'Forbidden' });

    const authorizedResponse = new FakeResponse();
    await invokeRoute(
      app,
      entry!,
      createFakeRequest({
        path: '/api/mastra/custom-auth',
        originalUrl: '/api/mastra/custom-auth',
        url: '/api/mastra/custom-auth',
        headers: {
          'x-api-key': 'loopback-secret',
          'x-user-id': 'custom-user',
        },
      }),
      authorizedResponse,
    );
    expect(authorizedResponse.statusCode).toBe(200);
    expect(authorizedResponse.jsonBody).toEqual({
      auth: {
        userId: 'custom-user',
        raw: { strategy: 'custom' },
      },
    });
  });

  it('allows consumers to compose a custom authorizer with Mastra route auth', async () => {
    const mastra = new Mastra();
    mastra.setServer({
      auth: {
        protected: ['/api/mastra/composed/*'],
        authenticateToken: async token => {
          if (token === 'valid-token') {
            return { id: 'user-2' };
          }
          return null;
        },
      },
    });

    const { app, routes } = createAppWithCapture();
    const adapter = new LoopbackMastraServer({
      app,
      mastra,
      config: {
        prefix: '/api/mastra',
        auth: {
          authorizeMode: 'after',
          authorize: async input => {
            return input.getHeader('x-tenant-id') ? null : { status: 403, error: 'Tenant header required' };
          },
        },
      },
    });

    await adapter.registerRoute(
      app,
      {
        method: 'GET',
        path: '/composed/resource',
        responseType: 'json',
        handler: async ({ requestContext }: { requestContext: { get: (key: string) => unknown } }) => ({
          user: requestContext.get('user'),
        }),
      } as never,
      { prefix: '/api/mastra' },
    );

    const entry = routes.find(route => route.path === '/api/mastra/composed/resource');
    expect(entry).toBeDefined();

    const missingTenantResponse = new FakeResponse();
    await invokeRoute(
      app,
      entry!,
      createFakeRequest({
        path: '/api/mastra/composed/resource',
        originalUrl: '/api/mastra/composed/resource',
        url: '/api/mastra/composed/resource',
        headers: {
          authorization: 'Bearer valid-token',
        },
      }),
      missingTenantResponse,
    );
    expect(missingTenantResponse.statusCode).toBe(403);
    expect(missingTenantResponse.jsonBody).toEqual({ error: 'Tenant header required' });

    const successResponse = new FakeResponse();
    await invokeRoute(
      app,
      entry!,
      createFakeRequest({
        path: '/api/mastra/composed/resource',
        originalUrl: '/api/mastra/composed/resource',
        url: '/api/mastra/composed/resource',
        headers: {
          authorization: 'Bearer valid-token',
          'x-tenant-id': 'tenant-a',
        },
      }),
      successResponse,
    );
    expect(successResponse.statusCode).toBe(200);
    expect(successResponse.jsonBody).toEqual({
      user: { id: 'user-2' },
    });
  });

  it('registers a prefixed OpenAPI route that includes custom routes', async () => {
    const mastra = new Mastra();
    mastra.setServer({
      apiRoutes: [
        registerApiRoute('/customer/:id', {
          method: 'GET',
          handler: async c => c.json({ id: c.req.param('id') }),
          openapi: {
            summary: 'Get a customer by id',
          },
        }),
      ],
    });

    const { app, routes } = createAppWithCapture();
    const adapter = new LoopbackMastraServer({
      app,
      mastra,
      config: {
        prefix: '/api/mastra',
        openapiPath: '/openapi.json',
        enableAuth: false,
      },
    });

    await adapter.init();

    const openapiEntry = routes.find(route => route.path === '/api/mastra/openapi.json');
    expect(openapiEntry).toBeDefined();

    const response = new FakeResponse();
    await invokeRoute(
      app,
      openapiEntry!,
      createFakeRequest({
        path: '/api/mastra/openapi.json',
        originalUrl: '/api/mastra/openapi.json',
        url: '/api/mastra/openapi.json',
      }),
      response,
    );

    const spec = response.jsonBody as {
      openapi: string;
      servers?: Array<{ url: string }>;
      paths?: Record<string, unknown>;
    };
    expect(spec.openapi).toMatch(/^3\./);
    expect(spec.servers).toEqual([{ url: '/api/mastra' }]);
    expect(spec.paths).toHaveProperty('/customer/{id}');
  });
});
