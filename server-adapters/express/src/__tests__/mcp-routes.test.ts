import type { Server } from 'node:http';
import { createMCPRouteTestSuite } from '@internal/server-adapter-test-utils';
import type { AdapterTestContext, HttpRequest, HttpResponse } from '@internal/server-adapter-test-utils';
import express from 'express';
import type { Application } from 'express';
import { describe } from 'vitest';
import { MastraServer } from '../index';

/**
 * Express Integration Tests for MCP Registry Routes
 */
describe('Express MCP Registry Routes Integration', () => {
  createMCPRouteTestSuite({
    suiteName: 'Express Adapter',

    setupAdapter: async (context: AdapterTestContext) => {
      // Create Express app
      const app = express();
      app.use(express.json());

      // Create adapter
      const adapter = new MastraServer({
        app,
        mastra: context.mastra,
        taskStore: context.taskStore,
        customRouteAuthConfig: context.customRouteAuthConfig,
      });

      // Register context middleware
      await adapter.init();

      return { app, adapter };
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

        // Add body for POST/PUT/PATCH/DELETE
        if (httpRequest.body && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(httpRequest.method)) {
          fetchOptions.body = JSON.stringify(httpRequest.body);
        }

        // Execute request
        const response = await fetch(url, fetchOptions);

        // Extract headers
        const headers: Record<string, string> = {};
        response.headers.forEach((value, key) => {
          headers[key] = value;
        });

        // Parse JSON response
        const data = await response.json();

        return {
          status: response.status,
          type: 'json',
          data,
          headers,
        };
      } finally {
        // Clean up server
        await new Promise<void>((resolve, reject) => {
          server.close(err => (err ? reject(err) : resolve()));
        });
      }
    },
  });
});
