import express, { type Application } from 'express';
import { ExpressServerAdapter } from '../index';
import { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import {
  createRouteAdapterTestSuite,
  type AdapterTestContext,
  type HttpRequest,
  type HttpResponse,
} from '@mastra/server/server-adapter';
import { SERVER_ROUTES } from '@mastra/server/server-adapter';

// Create test suite for Express adapter
createRouteAdapterTestSuite({
  suiteName: 'Express Adapter Integration Tests',
  routes: SERVER_ROUTES,

  setupAdapter: (context: AdapterTestContext) => {
    const app = express();

    // Add JSON body parser
    app.use(express.json());

    // Create Express adapter
    const adapter = new ExpressServerAdapter({
      mastra: context.mastra,
      tools: context.tools,
      taskStore: context.taskStore,
      customRouteAuthConfig: context.customRouteAuthConfig,
      playground: context.playground,
      isDev: context.isDev,
    });

    // Register context middleware
    app.use(adapter.createContextMiddleware());

    // Register all routes
    SERVER_ROUTES.forEach(route => {
      adapter.registerRoute(app, route, { prefix: '' });
    });

    return { adapter, app };
  },

  executeHttpRequest: async (app: Application, request: HttpRequest): Promise<HttpResponse> => {
    return new Promise((resolve, reject) => {
      // Build URL with query params
      let url = request.path;
      if (request.query) {
        const queryParams = new URLSearchParams();
        Object.entries(request.query).forEach(([key, value]) => {
          if (Array.isArray(value)) {
            value.forEach(v => queryParams.append(key, v));
          } else {
            queryParams.append(key, value);
          }
        });
        const queryString = queryParams.toString();
        if (queryString) {
          url += `?${queryString}`;
        }
      }

      // Create Node.js http request
      const req = {
        method: request.method,
        url,
        headers: {
          'content-type': 'application/json',
          ...(request.headers || {}),
        },
        body: request.body,
      };

      // Mock response object
      const chunks: Buffer[] = [];
      let statusCode = 200;
      const headers: Record<string, string> = {};

      const mockRes: any = {
        status(code: number) {
          statusCode = code;
          return this;
        },
        json(data: unknown) {
          const jsonData = JSON.stringify(data);
          resolve({
            status: statusCode,
            type: 'json',
            data,
            headers,
          });
        },
        send(data: unknown) {
          resolve({
            status: statusCode,
            type: 'json',
            data,
            headers,
          });
        },
        setHeader(name: string, value: string) {
          headers[name.toLowerCase()] = value;
        },
        write(chunk: unknown) {
          if (typeof chunk === 'string') {
            chunks.push(Buffer.from(chunk));
          } else if (Buffer.isBuffer(chunk)) {
            chunks.push(chunk);
          }
        },
        end() {
          // Stream response
          if (chunks.length > 0) {
            resolve({
              status: statusCode,
              type: 'stream',
              stream: Buffer.concat(chunks),
              headers,
            });
          } else {
            resolve({
              status: statusCode,
              type: 'json',
              data: null,
              headers,
            });
          }
        },
        sendStatus(code: number) {
          statusCode = code;
          resolve({
            status: code,
            type: 'json',
            data: null,
            headers,
          });
        },
        locals: {},
      };

      // Mock request object
      const mockReq: any = {
        method: request.method,
        url,
        path: request.path,
        params: {},
        query: request.query || {},
        body: request.body,
        headers: req.headers,
      };

      // Call Express app
      app(mockReq, mockRes, (err: Error) => {
        if (err) {
          reject(err);
        } else {
          // No route matched
          resolve({
            status: 404,
            type: 'json',
            data: { error: 'Not Found' },
            headers: {},
          });
        }
      });
    });
  },

  createTestContext: async (): Promise<AdapterTestContext> => {
    // Create test Mastra instance with entities matching auto-generated IDs
    const mastra = new Mastra({
      agents: [
        new Agent({
          name: 'test-agent',
          instructions: 'Test agent for integration tests',
          model: {
            provider: 'OPEN_AI',
            name: 'gpt-4',
            toolChoice: 'auto',
          },
        }),
      ],
      workflows: [],
    });

    return {
      mastra,
    };
  },
});
