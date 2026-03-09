import { createMCPRouteTestSuite } from '@internal/server-adapter-test-utils';
import type { AdapterTestContext, HttpRequest, HttpResponse } from '@internal/server-adapter-test-utils';
import { Hono } from 'hono';
import { describe } from 'vitest';
import { MastraServer } from '../index';

/**
 * Hono Integration Tests for MCP Registry Routes
 */
describe('Hono MCP Registry Routes Integration', () => {
  createMCPRouteTestSuite({
    suiteName: 'Hono Adapter',

    setupAdapter: async (context: AdapterTestContext) => {
      // Create Hono app with explicit type parameters to avoid 'as any'
      const app = new Hono<any, any, any>();

      // Create adapter
      const adapter = new MastraServer({
        app,
        mastra: context.mastra,
        taskStore: context.taskStore,
        customRouteAuthConfig: context.customRouteAuthConfig,
      });

      // Register context middleware
      await adapter.init();

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
