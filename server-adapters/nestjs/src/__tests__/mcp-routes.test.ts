import type { Server } from 'node:http';
import { createMCPRouteTestSuite } from '@internal/server-adapter-test-utils';
import type { AdapterTestContext, HttpRequest, HttpResponse } from '@internal/server-adapter-test-utils';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import express from 'express';
import type { Application } from 'express';
import { describe } from 'vitest';

import { MastraModule } from '../index';

/**
 * NestJS Integration Tests for MCP Registry Routes
 *
 * These verify MCP registry endpoints are exposed via the NestJS adapter.
 */
describe('NestJS MCP Registry Routes Integration', () => {
  createMCPRouteTestSuite({
    suiteName: 'NestJS Adapter',

    setupAdapter: async (context: AdapterTestContext) => {
      // Create NestJS app using MastraModule
      const moduleRef = await Test.createTestingModule({
        imports: [
          MastraModule.register({
            mastra: context.mastra,
            taskStore: context.taskStore,
            customRouteAuthConfig: context.customRouteAuthConfig,
          }),
        ],
      }).compile();

      const nestApp = moduleRef.createNestApplication();

      // Get underlying Express app and add JSON parsing
      const expressApp = nestApp.getHttpAdapter().getInstance() as Application;
      expressApp.use(express.json());

      await nestApp.init();

      // Attach NestJS app for cleanup
      (expressApp as any).nestApp = nestApp;

      // Return adapter with mastra property that the test suite expects
      return {
        app: expressApp,
        adapter: { mastra: context.mastra },
      };
    },

    executeHttpRequest: async (
      app: Application & { nestApp?: INestApplication; server?: Server },
      httpRequest: HttpRequest,
    ): Promise<HttpResponse> => {
      // Start server on random port if not already running
      if (!app.server) {
        app.server = await new Promise(resolve => {
          const s = app.listen(0, () => resolve(s));
        });
      }

      const address = app.server.address();
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

      // Parse response body safely
      const text = await response.text();
      let data: unknown = {};
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

    cleanupAdapter: async (app: Application & { nestApp?: INestApplication; server?: Server }) => {
      // Close NestJS app first, then server
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
});
