import type { Router } from '@adonisjs/core/http';
import { createHttpLoggingTestSuite } from '@mastra/server-adapters-test-suite';
import { describe } from 'vitest';
import { MastraServer } from '../index';
import { createAdonisRouterFor, getApplication, listen, rawRequest } from './helpers';

const application = await getApplication();

describe('AdonisJS Server Adapter', () => {
  createHttpLoggingTestSuite<Router>({
    suiteName: 'AdonisJS HTTP Logging',
    createApp: () => createAdonisRouterFor(application),
    setupAdapter: async (app, mastra) => ({ adapter: new MastraServer({ app, mastra }), app }),
    // Application routes registered next to Mastra's, as in start/routes.ts
    addRoute: (app, method, path, handler) => {
      app.route(path, [method], async ctx => {
        const result = await handler(ctx.request);
        if (result?.status) {
          return ctx.response.status(result.status).json(result.body || {});
        }
        return ctx.response.json(result);
      });
    },
    executeRequest: async (app, method, url, options = {}) => {
      const { url: baseUrl, close } = await listen(app);
      try {
        const { pathname, search } = new URL(url);
        const headers = { ...(options.body ? { 'content-type': 'application/json' } : {}), ...options.headers };
        const response = await rawRequest(`${baseUrl}${pathname}${search}`, method, { headers, body: options.body });
        // The log is written on the response 'finish' event; let it run before asserting
        await new Promise(resolve => setImmediate(resolve));
        return { status: response.status };
      } finally {
        await close();
      }
    },
  });
});
