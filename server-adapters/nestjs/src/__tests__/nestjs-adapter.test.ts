import type { Server } from 'node:http';
import type {
  AdapterTestContext,
  AdapterSetupOptions,
  HttpRequest,
  HttpResponse,
} from '@internal/server-adapter-test-utils';
import { createRouteAdapterTestSuite } from '@internal/server-adapter-test-utils';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Application } from 'express';
import { describe } from 'vitest';

import { MastraModule } from '../index';

// Extended app type to track NestJS app and server
type NestJSTestApp = Application & {
  nestApp?: INestApplication;
  server?: Server;
  port?: number;
};

// Wrapper describe block so the factory can call describe() inside
describe('NestJS Server Adapter', () => {
  createRouteAdapterTestSuite({
    suiteName: 'NestJS Adapter Integration Tests',

    setupAdapter: async (context: AdapterTestContext, options?: AdapterSetupOptions) => {
      // Create a NestJS app using MastraModule
      const moduleRef = await Test.createTestingModule({
        imports: [
          MastraModule.register({
            mastra: context.mastra,
            // Use provided prefix or default to '/api' (matches test-helpers default)
            prefix: options?.prefix ?? '/api',
            tools: context.tools,
            taskStore: context.taskStore,
            customRouteAuthConfig: context.customRouteAuthConfig,
          }),
        ],
      }).compile();

      const nestApp: INestApplication = moduleRef.createNestApplication();
      await nestApp.init();

      // Get the underlying Express app
      const expressApp = nestApp.getHttpAdapter().getInstance() as NestJSTestApp;

      // Start server on random port
      const server: Server = await new Promise(resolve => {
        const s = expressApp.listen(0, () => resolve(s));
      });

      const address = server.address();
      if (!address || typeof address === 'string') {
        throw new Error('Failed to get server address');
      }

      // Attach NestJS app and server for cleanup
      expressApp.nestApp = nestApp;
      expressApp.server = server;
      expressApp.port = address.port;

      return { app: expressApp, adapter: null, nestApp };
    },

    executeHttpRequest: async (app: NestJSTestApp, httpRequest: HttpRequest): Promise<HttpResponse> => {
      const port = app.port;
      if (!port) {
        throw new Error('Server port not set');
      }

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

      // Check if this is a streaming response
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('text/event-stream') || contentType.includes('text/plain')) {
        // Return streaming response
        const headers: Record<string, string> = {};
        response.headers.forEach((value, key) => {
          headers[key] = value;
        });
        return {
          status: response.status,
          type: 'stream',
          stream: response.body as any,
          headers,
        };
      }

      // Extract headers
      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });

      // Parse JSON response
      let data: unknown = {};
      const text = await response.text();
      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          data = { raw: text };
        }
      }

      return {
        status: response.status,
        type: 'json',
        data,
        headers,
      };
    },

    // Override cleanup to close NestJS app and server
    cleanupAdapter: async (app: NestJSTestApp) => {
      if (app.nestApp) {
        await app.nestApp.close();
      }
      if (app.server) {
        await new Promise<void>((resolve, reject) => {
          app.server!.close(err => (err ? reject(err) : resolve()));
        });
      }
    },
  });

  // Note: Multipart FormData tests live in multipart.test.ts to avoid requiring
  // dynamic route registration through the adapter API.
});
