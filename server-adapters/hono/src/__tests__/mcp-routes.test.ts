import { describe } from 'vitest';
import { Hono } from 'hono';
import { MastraServer } from '../index';
import { createMCPRouteTestSuite } from '@internal/server-adapter-test-utils';
import type { AdapterTestContext, HttpRequest, HttpResponse } from '@internal/server-adapter-test-utils';

/**
 * Hono Integration Tests for MCP Registry Routes
 */
describe('Hono MCP Registry Routes Integration', () => {
  createMCPRouteTestSuite({
    suiteName: 'Hono Adapter',

    setupAdapter: (context: AdapterTestContext) => {
      // Create Hono app
      const app = new Hono();

      // Create adapter
      const adapter = new MastraServer({
        app: app as any,
        mastra: context.mastra,
        taskStore: context.taskStore,
        customRouteAuthConfig: context.customRouteAuthConfig,
        playground: context.playground,
        isDev: context.isDev,
      });

      // Register context middleware
      adapter.init();

      return { app, adapter };
    },

    executeHttpRequest: async (app: Hono, request: HttpRequest): Promise<HttpResponse> => {
      // Build URL with query params
      let url = request.path;
      if (request.query) {
        const queryParams = new URLSearchParams();
        Object.entries(request.query).forEach(([key, value]) => {
          if (Array.isArray(value)) {
            value.forEach(v => queryParams.append(key, String(v)));
          } else {
            queryParams.append(key, String(value));
          }
        });
        const queryString = queryParams.toString();
        if (queryString) {
          url += `?${queryString}`;
        }
      }

      // Make request using Hono's request method
      const res = await app.request(url, {
        method: request.method,
        headers: {
          'Content-Type': 'application/json',
          ...(request.headers || {}),
        },
        body: request.body ? JSON.stringify(request.body) : undefined,
      });

      return {
        status: res.status,
        type: 'json',
        data: await res.json(),
        headers: Object.fromEntries(res.headers.entries()),
      };
    },
  });
});
