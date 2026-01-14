import { createHttpLoggingTestSuite } from '@internal/server-adapter-test-utils';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { describe, afterEach } from 'vitest';
import { MastraServer } from '../index';

describe('Fastify Server Adapter', () => {
  let app: FastifyInstance | null = null;

  afterEach(async () => {
    if (app) {
      await app.close();
      app = null;
    }
  });

  createHttpLoggingTestSuite({
    suiteName: 'Fastify HTTP Logging',

    createApp: () => {
      app = Fastify({ logger: false });
      return app;
    },

    setupAdapter: async (app, mastra) => {
      const adapter = new MastraServer({ app, mastra });
      return { adapter, app };
    },

    addRoute: async (app, method, path, handler) => {
      const routeHandler = async (request: any, reply: any) => {
        const result = await handler({});
        if (result.status) {
          return reply.status(result.status).send(result.body || {});
        }
        return result.body || result;
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
      const parsedUrl = new URL(url);
      const injectOptions: any = {
        method,
        url: parsedUrl.pathname + parsedUrl.search,
        headers: options.headers || {},
      };

      // Include payload and content-type if body is provided
      if (options.body) {
        injectOptions.payload = options.body;
        injectOptions.headers['content-type'] = 'application/json';
      }

      const response = await app.inject(injectOptions);

      // Wait for finish event to complete before returning
      // This ensures HTTP logging completes before the test continues
      await new Promise(resolve => setImmediate(resolve));

      return { status: response.statusCode };
    },
  });
});
