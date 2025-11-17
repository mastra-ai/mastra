import type { Server } from 'http';
import type { AdapterTestContext, HttpRequest, HttpResponse } from '@internal/server-adapter-test-utils';
import { createRouteAdapterTestSuite } from '@internal/server-adapter-test-utils';
import { SERVER_ROUTES } from '@mastra/server/server-adapter';
import express from 'express';
import type { Application } from 'express';
import { describe } from 'vitest';
import { ExpressServerAdapter } from '../index';

// Wrapper describe block so the factory can call describe() inside
describe('Express Server Adapter', () => {
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

    executeHttpRequest: async (app: Application, httpRequest: HttpRequest): Promise<HttpResponse> => {
      // Start server on random port
      const server: Server = await new Promise(resolve => {
        const s = app.listen(0, () => resolve(s));
      });

      try {
        const address = server.address();
        if (!address || typeof address === 'string') {
          throw new Error('Failed to get server address');
        }
        const port = address.port;
        const baseUrl = `http://localhost:${port}`;

        // Build URL with query params
        let url = `${baseUrl}${httpRequest.path}`;
        if (httpRequest.query) {
          const queryParams = new URLSearchParams();
          Object.entries(httpRequest.query).forEach(([key, value]) => {
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

        // Build fetch options
        const fetchOptions: RequestInit = {
          method: httpRequest.method,
          headers: {
            'Content-Type': 'application/json',
            ...(httpRequest.headers || {}),
          },
        };

        // Add body for POST/PUT/PATCH
        if (httpRequest.body && ['POST', 'PUT', 'PATCH'].includes(httpRequest.method)) {
          fetchOptions.body = JSON.stringify(httpRequest.body);
        }

        // Execute request
        const response = await fetch(url, fetchOptions);

        // Extract headers
        const headers: Record<string, string> = {};
        response.headers.forEach((value, key) => {
          headers[key] = value;
        });

        // Check if stream response
        const contentType = response.headers.get('content-type') || '';
        const transferEncoding = response.headers.get('transfer-encoding') || '';
        const isStream = contentType.includes('text/plain') || transferEncoding === 'chunked';

        if (isStream && response.body) {
          // Return stream response
          return {
            status: response.status,
            type: 'stream',
            stream: response.body,
            headers,
          };
        } else {
          // JSON response - check content type to decide how to parse
          let data: unknown;
          const responseContentType = response.headers.get('content-type') || '';

          if (responseContentType.includes('application/json')) {
            try {
              data = await response.json();
            } catch {
              // If JSON parsing fails, return empty object
              data = {};
            }
          } else {
            // Not JSON content type, read as text
            data = await response.text();
          }

          return {
            status: response.status,
            type: 'json',
            data,
            headers,
          };
        }
      } finally {
        // Always close server
        await new Promise<void>(resolve => {
          server.close(() => resolve());
        });
      }
    },
  });
});
