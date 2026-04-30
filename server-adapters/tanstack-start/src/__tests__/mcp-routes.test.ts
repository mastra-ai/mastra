import { createMCPRouteTestSuite } from '@internal/server-adapter-test-utils';
import type { AdapterTestContext, HttpRequest, HttpResponse } from '@internal/server-adapter-test-utils';
import { describe } from 'vitest';
import { MastraServer } from '../index';

describe('TanStack Start MCP Registry Routes Integration', () => {
  createMCPRouteTestSuite({
    suiteName: 'TanStack Start Adapter',
    setupAdapter: async (context: AdapterTestContext) => {
      const adapter = new MastraServer({
        mastra: context.mastra,
        taskStore: context.taskStore,
        customRouteAuthConfig: context.customRouteAuthConfig,
      });
      await adapter.init();
      return { app: adapter.app, adapter };
    },
    executeHttpRequest: async (app, request: HttpRequest): Promise<HttpResponse> => {
      let url = `http://localhost${request.path}`;
      if (request.query) {
        const queryParams = new URLSearchParams();
        Object.entries(request.query).forEach(([key, value]) => {
          if (Array.isArray(value)) value.forEach(v => queryParams.append(key, String(v)));
          else queryParams.append(key, String(value));
        });
        const queryString = queryParams.toString();
        if (queryString) url += `?${queryString}`;
      }

      const response = await app.request(
        new Request(url, {
          method: request.method,
          headers: { 'Content-Type': 'application/json', ...(request.headers || {}) },
          body: request.body ? JSON.stringify(request.body) : undefined,
        }),
      );

      return {
        status: response.status,
        type: 'json',
        data: await response.json(),
        headers: Object.fromEntries(response.headers.entries()),
      };
    },
  });
});
