import type { AdapterTestContext, HttpRequest, HttpResponse } from '@internal/server-adapter-test-utils';
import { createRouteAdapterTestSuite } from '@internal/server-adapter-test-utils';
import { Hono } from 'hono';
import { describe } from 'vitest';
import { MastraServer } from '../index';

// Wrapper describe block so the factory can call describe() inside
describe('Hono Server Adapter', () => {
  createRouteAdapterTestSuite({
    suiteName: 'Hono Adapter Integration Tests',

    setupAdapter: (context: AdapterTestContext) => {
      const app = new Hono();

      // Create Hono adapter
      const adapter = new MastraServer({
        app,
        mastra: context.mastra,
        tools: context.tools,
        taskStore: context.taskStore,
        customRouteAuthConfig: context.customRouteAuthConfig,
        playground: context.playground,
        isDev: context.isDev,
      });

      adapter.init();

      return { adapter, app };
    },

    executeHttpRequest: async (app: Hono, request: HttpRequest): Promise<HttpResponse> => {
      // Build full URL with query params
      let url = `http://localhost${request.path}`;
      if (request.query) {
        const queryParams = new URLSearchParams();
        Object.entries(request.query).forEach(([key, value]) => {
          if (Array.isArray(value)) {
            value.forEach(v => queryParams.append(key, v));
          } else {
            queryParams.append(key, value);
          }
        });
        const queryString = queryParams.toString();
        if (queryString) {
          url += `?${queryString}`;
        }
      }

      // Build Web Request
      const req = new Request(url, {
        method: request.method,
        headers: {
          'Content-Type': 'application/json',
          ...(request.headers || {}),
        },
        body: request.body ? JSON.stringify(request.body) : undefined,
      });

      // Execute request through Hono
      let response: Response | ReadableStream;
      try {
        response = await app.request(req);
      } catch (error) {
        // If the request throws an error, return a 500 response
        return {
          status: 500,
          type: 'json',
          data: { error: error instanceof Error ? error.message : 'Unknown error' },
          headers: {},
        };
      }

      // Check if response is defined
      if (!response) {
        return {
          status: 500,
          type: 'json',
          data: { error: 'No response returned from handler' },
          headers: {},
        };
      }

      // Handle case where Hono returns a ReadableStream directly (datastream-response type)
      if (response instanceof ReadableStream) {
        return {
          status: 200, // Assume success if we get a stream
          type: 'stream',
          stream: response,
          headers: {},
        };
      }

      // Parse response
      const contentType = response.headers?.get('content-type') || '';
      const isStream = contentType.includes('text/plain') || response.headers?.get('transfer-encoding') === 'chunked';

      // Extract headers
      const headers: Record<string, string> = {};
      response.headers?.forEach((value, key) => {
        headers[key] = value;
      });

      if (isStream) {
        return {
          status: response.status,
          type: 'stream',
          stream: response.body,
          headers,
        };
      } else {
        let data: unknown;
        try {
          data = await response.json();
        } catch {
          data = await response.text();
        }

        return {
          status: response.status,
          type: 'json',
          data,
          headers,
        };
      }
    },
  });
});
