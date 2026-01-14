import { createHttpLoggingTestSuite } from '@internal/server-adapter-test-utils';
import Koa from 'koa';
import { describe } from 'vitest';
import { MastraServer } from '../index';

describe('Koa Server Adapter', () => {
  createHttpLoggingTestSuite({
    suiteName: 'Koa HTTP Logging',

    createApp: () => new Koa(),

    setupAdapter: async (app, mastra) => {
      const adapter = new MastraServer({ app, mastra });
      return { adapter, app };
    },

    addRoute: async (app, method, path, handler) => {
      app.use(async (ctx: any, next: any) => {
        if (ctx.method === method && ctx.path === path) {
          const result = await handler(ctx);
          if (result.status) {
            ctx.status = result.status;
            ctx.body = result.body || {};
          } else {
            ctx.body = result;
          }
        } else {
          await next();
        }
      });
    },

    executeRequest: async (app, method, url, options = {}) => {
      const parsedUrl = new URL(url);
      const path = parsedUrl.pathname;
      const query = Object.fromEntries(parsedUrl.searchParams);

      return new Promise(resolve => {
        // Create mock Koa context
        let statusCode = 200;
        const ctx: any = {
          method,
          path,
          query,
          headers: options.headers || {},
          status: statusCode,
          body: undefined,
        };

        // Override status setter
        Object.defineProperty(ctx, 'status', {
          get: () => statusCode,
          set: value => {
            statusCode = value;
          },
        });

        // Create callback
        const callback = app.callback();

        // Create minimal req/res objects
        const req: any = {
          method,
          url: parsedUrl.pathname + parsedUrl.search,
          headers: options.headers || {},
          on: () => {}, // Add on method for event listeners
        };

        const res: any = {
          statusCode,
          setHeader: () => {},
          removeHeader: () => {},
          end: () => {
            res.writableEnded = true;
            resolve({ status: statusCode });
          },
          on: () => {},
          writableEnded: false,
        };

        // Execute
        callback(req, res);
      });
    },
  });
});
