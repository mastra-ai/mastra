import type {
  AdapterTestContext,
  AdapterSetupOptions,
  HttpRequest,
  HttpResponse,
} from '@internal/server-adapter-test-utils';
import { createRouteAdapterTestSuite, createDefaultTestContext } from '@internal/server-adapter-test-utils';
import { describe, expect, it } from 'vitest';
import { MastraServer } from '../index';

describe('TanStack Start Server Adapter', () => {
  createRouteAdapterTestSuite({
    suiteName: 'TanStack Start Adapter Integration Tests',

    setupAdapter: async (context: AdapterTestContext, options?: AdapterSetupOptions) => {
      const adapter = new MastraServer({
        mastra: context.mastra,
        tools: context.tools,
        taskStore: context.taskStore,
        customRouteAuthConfig: context.customRouteAuthConfig,
        prefix: options?.prefix,
      });

      await adapter.init();
      return { adapter, app: adapter.app };
    },

    executeHttpRequest: async (app, httpRequest: HttpRequest): Promise<HttpResponse> => {
      let url = `http://localhost${httpRequest.path}`;
      if (httpRequest.query) {
        const queryParams = new URLSearchParams();
        Object.entries(httpRequest.query).forEach(([key, value]) => {
          if (Array.isArray(value)) value.forEach(v => queryParams.append(key, String(v)));
          else queryParams.append(key, String(value));
        });
        const queryString = queryParams.toString();
        if (queryString) url += `?${queryString}`;
      }

      const response = await app.request(
        new Request(url, {
          method: httpRequest.method,
          headers: { 'Content-Type': 'application/json', ...(httpRequest.headers || {}) },
          body: httpRequest.body ? JSON.stringify(httpRequest.body) : undefined,
        }),
      );

      const headers = Object.fromEntries(response.headers.entries());
      const contentType = response.headers.get('content-type') || '';
      const isStream =
        contentType.includes('text/plain') ||
        contentType.includes('text/event-stream') ||
        response.headers.get('transfer-encoding') === 'chunked';

      if (isStream) {
        return { status: response.status, type: 'stream', stream: response.body, headers };
      }
      let data: unknown;
      try {
        data = await response.json();
      } catch {
        data = await response.text();
      }
      return { status: response.status, type: 'json', data, headers };
    },
  });

  it('creates full handlers map for TanStack Start route files', async () => {
    const context = await createDefaultTestContext();
    const adapter = new MastraServer({ mastra: context.mastra });
    await adapter.init();

    const handlers = adapter.createRouteHandlers();
    expect(Object.keys(handlers).sort()).toEqual(['DELETE', 'GET', 'HEAD', 'OPTIONS', 'PATCH', 'POST', 'PUT']);
  });

  it('forwards request via createRequestHandler', async () => {
    const context = await createDefaultTestContext();
    const adapter = new MastraServer({ mastra: context.mastra });
    await adapter.init();

    const serve = adapter.createRequestHandler();
    const response = await serve({ request: new Request('http://localhost/api/agents', { method: 'GET' }) });
    expect(response.status).toBe(200);
  });
});
