import { createHttpLoggingTestSuite } from '@internal/server-adapter-test-utils';
import { Elysia } from 'elysia';
import { describe } from 'vitest';
import { MastraServer } from '../index';

describe('Elysia Server Adapter', () => {
  createHttpLoggingTestSuite({
    suiteName: 'Elysia HTTP Logging',

    createApp: () => new Elysia(),

    setupAdapter: async (app, mastra) => {
      const adapter = new MastraServer({ app, mastra });
      return { adapter, app };
    },

    addRoute: async (app, method, path, handler) => {
      const routeHandler = async (ctx: any) => {
        const result = await handler(ctx);
        if (result.status) {
          return new Response(JSON.stringify(result.body || {}), {
            status: result.status,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return result;
      };

      switch (method) {
        case 'GET':
          app.get(path, routeHandler);
          break;
        case 'POST':
          app.post(path, routeHandler);
          break;
        case 'PUT':
          app.put(path, routeHandler);
          break;
        case 'DELETE':
          app.delete(path, routeHandler);
          break;
      }
    },

    executeRequest: async (app, method, url, options = {}) => {
      const request = new Request(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers || {}),
        },
        ...(options.body ? { body: options.body } : {}),
      });

      const response = await app.fetch(request);
      return { status: response.status };
    },
  });
});
