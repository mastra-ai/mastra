import { createHttpLoggingTestSuite } from '@internal/server-adapter-test-utils';
import express from 'express';
import { describe } from 'vitest';
import { MastraServer } from '../index';

describe('Express Server Adapter', () => {
  createHttpLoggingTestSuite({
    suiteName: 'Express HTTP Logging',

    createApp: () => express(),

    setupAdapter: async (app, mastra) => {
      const adapter = new MastraServer({ app, mastra });
      return { adapter, app };
    },

    addRoute: async (app, method, path, handler) => {
      const routeHandler = async (req: any, res: any) => {
        const result = await handler(req);
        if (result.status) {
          res.status(result.status).json(result.body || {});
        } else {
          res.json(result);
        }
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
      // Parse URL for path and query
      const parsedUrl = new URL(url);
      const path = parsedUrl.pathname + parsedUrl.search;

      return new Promise(resolve => {
        // Create mock request
        const req: any = {
          method,
          url: path,
          path: parsedUrl.pathname,
          query: Object.fromEntries(parsedUrl.searchParams),
          headers: options.headers || {},
          body: options.body ? JSON.parse(options.body) : undefined,
        };

        // Create mock response
        let statusCode = 200;
        let finishHandler: (() => void) | null = null;
        const res: any = {
          statusCode,
          status: (code: number) => {
            statusCode = code;
            res.statusCode = code;
            return res;
          },
          json: () => {
            // Trigger finish event before resolving
            if (finishHandler) {
              finishHandler();
            }
            setTimeout(() => resolve({ status: statusCode }), 0);
          },
          setHeader: () => {},
          on: (event: string, handler: () => void) => {
            if (event === 'finish') {
              finishHandler = handler;
            }
          },
        };

        // Execute the app
        app(req, res);
      });
    },
  });
});
