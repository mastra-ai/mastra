import { createHttpLoggingTestSuite } from '@internal/server-adapter-test-utils';
import Koa from 'koa';
import type { Context, Next } from 'koa';
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
      app.use(async (ctx: Context, next: Next) => {
        if (ctx.method === method && ctx.path === path) {
          const result = await handler(ctx);
          if (result && typeof result === 'object' && 'status' in result) {
            ctx.status = result.status;
            ctx.body = result.body ?? {};
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

      return new Promise<{ status: number }>((resolve, reject) => {
        const callback = app.callback();

        // Create minimal req/res objects
        const req: any = {
          method,
          url: parsedUrl.pathname + parsedUrl.search,
          headers: options.headers || {},
          on: () => {},
        };

        const headers: Record<string, string> = {};
        const res: any = {
          statusCode: 200,
          setHeader: (name: string, value: string) => {
            headers[name.toLowerCase()] = value;
          },
          getHeader: (name: string) => {
            return headers[name.toLowerCase()];
          },
          removeHeader: (name: string) => {
            delete headers[name.toLowerCase()];
          },
          end: () => {
            res.writableEnded = true;
            resolve({ status: res.statusCode });
          },
          on: () => {},
          writableEnded: false,
        };

        // Execute
        try {
          Promise.resolve(callback(req, res)).catch(reject);
        } catch (error) {
          reject(error);
        }
      });
    },
  });
});
