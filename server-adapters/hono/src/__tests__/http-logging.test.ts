import { createHttpLoggingTestSuite } from '@internal/server-adapter-test-utils';
import { Hono } from 'hono';
import { describe } from 'vitest';
import { MastraServer } from '../index';

describe('Hono Server Adapter', () => {
  createHttpLoggingTestSuite({
    suiteName: 'Hono HTTP Logging',

    createApp: () => new Hono(),

    setupAdapter: async (app, mastra) => {
      const adapter = new MastraServer({ app, mastra });
      return { adapter, app };
    },

    addRoute: async (app, method, path, handler) => {
      const routeHandler = async (c: any) => {
        const result = await handler(c);
        if (result.status) {
          return c.json(result.body || {}, result.status);
        }
        return c.json(result);
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

      const response = await app.request(request);
      return { status: response.status };
    },
  });
});
