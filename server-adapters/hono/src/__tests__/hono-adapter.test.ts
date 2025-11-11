import { describe } from 'vitest';
import { Hono } from 'hono';
import { HonoServerAdapter } from '../index';
import { Mastra } from '@mastra/core';
import {
  createRouteAdapterTestSuite,
  type AdapterTestContext,
  type HttpRequest,
  type HttpResponse,
} from '@internal/server-adapter-test-utils';
import { SERVER_ROUTES, createTestAgent, mockAgentMethods } from '@mastra/server/server-adapter';

// Wrapper describe block so the factory can call describe() inside
describe('Hono Server Adapter', () => {
  createRouteAdapterTestSuite({
    suiteName: 'Hono Adapter Integration Tests',
    routes: SERVER_ROUTES,

    setupAdapter: (context: AdapterTestContext) => {
      const app = new Hono();

      // Create Hono adapter
      const adapter = new HonoServerAdapter({
        mastra: context.mastra,
        tools: context.tools,
        taskStore: context.taskStore,
        customRouteAuthConfig: context.customRouteAuthConfig,
        playground: context.playground,
        isDev: context.isDev,
      });

      // Register context middleware
      app.use('*', adapter.createContextMiddleware());

      // Register all routes
      SERVER_ROUTES.forEach(route => {
        adapter.registerRoute(app, route, { prefix: '' });
      });

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
      let response: Response;
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

      // Parse response
      const contentType = response.headers.get('content-type') || '';
      const isJson = contentType.includes('application/json');
      const isStream = contentType.includes('text/plain') || response.headers.get('transfer-encoding') === 'chunked';

      // Extract headers
      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
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

    createTestContext: async (): Promise<AdapterTestContext> => {
      // Create test agent with mocked methods to avoid API calls
      const agent = createTestAgent({ name: 'test-agent' });
      mockAgentMethods(agent);

      // Create test Mastra instance with entities matching auto-generated IDs
      const mastra = new Mastra({
        logger: false,
        agents: {
          'test-agent': agent,
        },
        workflows: {},
      });

      return {
        mastra,
      };
    },
  });
});
