import type { AdapterTestContext, HttpRequest, HttpResponse } from '@internal/server-adapter-test-utils';
import {
  createRouteAdapterTestSuite,
  createDefaultTestContext,
  createStreamWithSensitiveData,
  consumeSSEStream,
  createMultipartTestSuite,
} from '@internal/server-adapter-test-utils';
import type { ServerRoute } from '@mastra/server/server-adapter';
import { Module } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { MastraServer } from '../index';

// Minimal test module
@Module({})
class TestAppModule {}

describe('NestJS Server Adapter (Fastify Platform)', () => {
  createRouteAdapterTestSuite({
    suiteName: 'NestJS Fastify Adapter Integration Tests',

    setupAdapter: async (context: AdapterTestContext) => {
      // Create NestJS app with Fastify platform
      const app = await NestFactory.create<NestFastifyApplication>(TestAppModule, new FastifyAdapter(), {
        logger: false,
      });

      const adapter = new MastraServer({
        app,
        mastra: context.mastra,
        taskStore: context.taskStore,
        customRouteAuthConfig: context.customRouteAuthConfig,
      });

      await adapter.init();

      // Verify we're using Fastify
      expect(adapter.getPlatformType()).toBe('fastify');

      return { app, adapter };
    },

    executeHttpRequest: async (app: INestApplication, httpRequest: HttpRequest): Promise<HttpResponse> => {
      await app.listen(0);
      const server = app.getHttpServer();

      try {
        const address = server.address();
        if (!address || typeof address === 'string') {
          throw new Error('Failed to get server address');
        }
        const port = address.port;
        const baseUrl = `http://localhost:${port}`;

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

        const fetchOptions: RequestInit = {
          method: httpRequest.method,
          headers: {
            ...(httpRequest.headers || {}),
          },
        };

        if (httpRequest.body && ['POST', 'PUT', 'PATCH'].includes(httpRequest.method)) {
          fetchOptions.body = JSON.stringify(httpRequest.body);
          (fetchOptions.headers as Record<string, string>)['Content-Type'] = 'application/json';
        }

        const response = await fetch(url, fetchOptions);

        const headers: Record<string, string> = {};
        response.headers.forEach((value, key) => {
          headers[key] = value;
        });

        const contentType = response.headers.get('content-type') || '';
        const transferEncoding = response.headers.get('transfer-encoding') || '';
        const isStream = contentType.includes('text/plain') || transferEncoding === 'chunked';

        if (isStream && response.body) {
          return { status: response.status, type: 'stream', stream: response.body, headers };
        } else {
          let data: unknown;
          if (contentType.includes('application/json')) {
            try {
              data = await response.json();
            } catch {
              data = {};
            }
          } else {
            data = await response.text();
          }
          return { status: response.status, type: 'json', data, headers };
        }
      } finally {
        await app.close();
      }
    },
  });

  describe('Fastify Stream Data Redaction', () => {
    let context: AdapterTestContext;
    let app: NestFastifyApplication | null = null;

    beforeEach(async () => {
      context = await createDefaultTestContext();
    });

    afterEach(async () => {
      if (app) {
        await app.close();
        app = null;
      }
    });

    it('should redact sensitive data from stream chunks by default', async () => {
      app = await NestFactory.create<NestFastifyApplication>(TestAppModule, new FastifyAdapter(), { logger: false });

      const adapter = new MastraServer({
        app,
        mastra: context.mastra,
      });

      const testRoute: ServerRoute<any, any, any> = {
        method: 'POST',
        path: '/test/stream',
        responseType: 'stream',
        streamFormat: 'sse',
        handler: async () => createStreamWithSensitiveData('v2'),
      };

      adapter.registerContextMiddleware();
      await adapter.registerRoute(app, testRoute, { prefix: '' });

      await app.listen(0);
      const server = app.getHttpServer();
      const address = server.address();
      if (!address || typeof address === 'string') {
        throw new Error('Failed to get server address');
      }
      const port = address.port;

      const response = await fetch(`http://localhost:${port}/test/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(200);

      const chunks = await consumeSSEStream(response.body);
      expect(chunks.length).toBeGreaterThan(0);

      const allChunksStr = JSON.stringify(chunks);
      expect(allChunksStr).not.toContain('SECRET_SYSTEM_PROMPT');
      expect(allChunksStr).not.toContain('secret_tool');
    });

    it('should NOT redact sensitive data when streamOptions.redact is false', async () => {
      app = await NestFactory.create<NestFastifyApplication>(TestAppModule, new FastifyAdapter(), { logger: false });

      const adapter = new MastraServer({
        app,
        mastra: context.mastra,
        streamOptions: { redact: false },
      });

      const testRoute: ServerRoute<any, any, any> = {
        method: 'POST',
        path: '/test/stream',
        responseType: 'stream',
        streamFormat: 'sse',
        handler: async () => createStreamWithSensitiveData('v2'),
      };

      adapter.registerContextMiddleware();
      await adapter.registerRoute(app, testRoute, { prefix: '' });

      await app.listen(0);
      const server = app.getHttpServer();
      const address = server.address();
      if (!address || typeof address === 'string') {
        throw new Error('Failed to get server address');
      }
      const port = address.port;

      const response = await fetch(`http://localhost:${port}/test/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(200);

      const chunks = await consumeSSEStream(response.body);
      expect(chunks.length).toBeGreaterThan(0);

      const allChunksStr = JSON.stringify(chunks);
      expect(allChunksStr).toContain('SECRET_SYSTEM_PROMPT');
      expect(allChunksStr).toContain('secret_tool');
    });
  });

  describe('Fastify Abort Signal', () => {
    let context: AdapterTestContext;
    let app: NestFastifyApplication | null = null;

    beforeEach(async () => {
      context = await createDefaultTestContext();
    });

    afterEach(async () => {
      if (app) {
        await app.close();
        app = null;
      }
    });

    it('should not have aborted signal when route handler executes', async () => {
      app = await NestFactory.create<NestFastifyApplication>(TestAppModule, new FastifyAdapter(), { logger: false });

      const adapter = new MastraServer({
        app,
        mastra: context.mastra,
      });

      let abortSignalAborted: boolean | undefined;

      const testRoute: ServerRoute<any, any, any> = {
        method: 'POST',
        path: '/test/abort-signal',
        responseType: 'json',
        handler: async (params: any) => {
          abortSignalAborted = params.abortSignal?.aborted;
          return { signalAborted: abortSignalAborted };
        },
      };

      adapter.registerContextMiddleware();
      await adapter.registerRoute(app, testRoute, { prefix: '' });

      await app.listen(0);
      const server = app.getHttpServer();
      const address = server.address();
      if (!address || typeof address === 'string') {
        throw new Error('Failed to get server address');
      }
      const port = address.port;

      const response = await fetch(`http://localhost:${port}/test/abort-signal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: 'data' }),
      });

      expect(response.status).toBe(200);
      const result = await response.json();

      expect(result.signalAborted).toBe(false);
      expect(abortSignalAborted).toBe(false);
    });

    it('should provide abort signal to route handlers', async () => {
      app = await NestFactory.create<NestFastifyApplication>(TestAppModule, new FastifyAdapter(), { logger: false });

      const adapter = new MastraServer({
        app,
        mastra: context.mastra,
      });

      let receivedAbortSignal: AbortSignal | undefined;

      const testRoute: ServerRoute<any, any, any> = {
        method: 'POST',
        path: '/test/abort-signal-exists',
        responseType: 'json',
        handler: async (params: any) => {
          receivedAbortSignal = params.abortSignal;
          return { hasSignal: !!params.abortSignal };
        },
      };

      adapter.registerContextMiddleware();
      await adapter.registerRoute(app, testRoute, { prefix: '' });

      await app.listen(0);
      const server = app.getHttpServer();
      const address = server.address();
      if (!address || typeof address === 'string') {
        throw new Error('Failed to get server address');
      }
      const port = address.port;

      const response = await fetch(`http://localhost:${port}/test/abort-signal-exists`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(200);
      const result = await response.json();

      expect(result.hasSignal).toBe(true);
      expect(receivedAbortSignal).toBeDefined();
      expect(receivedAbortSignal).toBeInstanceOf(AbortSignal);
    });
  });

  // Multipart FormData tests
  createMultipartTestSuite({
    suiteName: 'NestJS Fastify Multipart FormData',

    setupAdapter: async (context, options) => {
      const app = await NestFactory.create<NestFastifyApplication>(TestAppModule, new FastifyAdapter(), {
        logger: false,
      });

      const adapter = new MastraServer({
        app,
        mastra: context.mastra,
        taskStore: context.taskStore,
        bodyLimitOptions: options?.bodyLimitOptions,
      });

      await adapter.init();

      return { app, adapter };
    },

    startServer: async (app: INestApplication) => {
      await app.listen(0);
      const server = app.getHttpServer();
      const address = server.address();
      if (!address || typeof address === 'string') {
        throw new Error('Failed to get server address');
      }

      return {
        baseUrl: `http://localhost:${address.port}`,
        cleanup: async () => {
          await app.close();
        },
      };
    },

    registerRoute: async (adapter, app, route, options) => {
      await adapter.registerRoute(app, route, options || { prefix: '' });
    },

    getContextMiddleware: adapter => adapter.createContextMiddleware(),

    applyMiddleware: (app, middleware) => {
      const httpAdapter = app.getHttpAdapter();
      const instance = httpAdapter.getInstance();
      instance.addHook('preHandler', middleware);
    },
  });
});
