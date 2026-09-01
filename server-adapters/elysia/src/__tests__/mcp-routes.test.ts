import { createMCPRouteTestSuite } from '@internal/server-adapter-test-utils';
import type { AdapterTestContext, HttpRequest, HttpResponse } from '@internal/server-adapter-test-utils';
import { Elysia } from 'elysia';
import { describe } from 'vitest';
import { MastraServer } from '../index';

/**
 * Elysia Integration Tests for MCP Registry Routes
 */
describe('Elysia MCP Registry Routes Integration', () => {
  createMCPRouteTestSuite({
    suiteName: 'Elysia Adapter',

    setupAdapter: async (context: AdapterTestContext) => {
      const app = new Elysia();

      const adapter = new MastraServer({
        app,
        mastra: context.mastra,
        taskStore: context.taskStore,
        customRouteAuthConfig: context.customRouteAuthConfig,
      });

      await adapter.init();

      return { app, adapter };
    },

    executeHttpRequest: async (app: Elysia, request: HttpRequest): Promise<HttpResponse> => {
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

      const fullUrl = `http://localhost${url}`;

      const res = await app.fetch(
        new Request(fullUrl, {
          method: request.method,
          headers: {
            'Content-Type': 'application/json',
            ...(request.headers || {}),
          },
          body: request.body ? JSON.stringify(request.body) : undefined,
        }),
      );

      return {
        status: res.status,
        type: 'json',
        data: await res.json(),
        headers: Object.fromEntries(res.headers.entries()),
      };
    },
  });
});
