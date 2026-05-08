import { createMCPRouteTestSuite } from '@internal/server-adapter-test-utils';
import type { AdapterTestContext, HttpRequest, HttpResponse } from '@internal/server-adapter-test-utils';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { describe } from 'vitest';
import { MastraServer } from '../index';

/**
 * Fastify Integration Tests for MCP Registry Routes
 */
describe('Fastify MCP Registry Routes Integration', () => {
  createMCPRouteTestSuite({
    suiteName: 'Fastify Adapter',

    setupAdapter: async (context: AdapterTestContext) => {
      // Create Fastify app
      const app = Fastify();

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

    executeHttpRequest: async (app: FastifyInstance, httpRequest: HttpRequest): Promise<HttpResponse> => {
      // Start server on random port
      const address = await app.listen({ port: 0 });

      try {
        // Build URL with query params
        let url = `${address}${httpRequest.path}`;
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
        await app.close();
      }
    },
  });
});
