import { createDefaultTestContext } from '@internal/server-adapter-test-utils';
import type { AdapterTestContext } from '@internal/server-adapter-test-utils';
import type { Mastra } from '@mastra/core/mastra';
import { Injectable, Inject } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import express from 'express';
import type { Application } from 'express';
import { describe, it, expect, beforeEach } from 'vitest';
import { MastraModule, MastraService, MASTRA, MASTRA_OPTIONS, ShutdownService } from '../index';
import { executeExpressRequest } from './test-helpers';

describe('MastraModule', () => {
  let context: AdapterTestContext;

  beforeEach(async () => {
    context = await createDefaultTestContext();
  });

  describe('register()', () => {
    it('should register Mastra instance via DI', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [MastraModule.register({ mastra: context.mastra })],
      }).compile();

      const injectedMastra = moduleRef.get(MASTRA);
      expect(injectedMastra).toBe(context.mastra);
    });

    it('should provide MastraService', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [MastraModule.register({ mastra: context.mastra })],
      }).compile();

      const service = moduleRef.get(MastraService);
      expect(service).toBeInstanceOf(MastraService);
      expect(service.getMastra()).toBe(context.mastra);
    });

    it('should pass options to module', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [
          MastraModule.register({
            mastra: context.mastra,
            prefix: '/custom-prefix',
            openapiPath: '/openapi.json',
          }),
        ],
      }).compile();

      const service = moduleRef.get(MastraService);
      expect(service.getMastra()).toBe(context.mastra);

      // Verify options are accessible
      const options = service.getOptions();
      expect(options.prefix).toBe('/custom-prefix');
      expect(options.openapiPath).toBe('/openapi.json');
    });

    it('should provide ShutdownService for graceful shutdown', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [MastraModule.register({ mastra: context.mastra })],
      }).compile();

      const shutdownService = moduleRef.get(ShutdownService);
      expect(shutdownService).toBeDefined();
      expect(shutdownService.shuttingDown).toBe(false);
    });
  });

  describe('registerAsync()', () => {
    it('should support useFactory', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [
          MastraModule.registerAsync({
            useFactory: async () => ({ mastra: context.mastra }),
          }),
        ],
      }).compile();

      const injectedMastra = moduleRef.get(MASTRA);
      expect(injectedMastra).toBe(context.mastra);
    });

    it('should support factory with injected dependencies', async () => {
      const CONFIG_TOKEN = 'CONFIG_TOKEN';
      const mockConfig = { prefix: '/api/v2' };

      // Create a config module to provide the dependency
      const ConfigModule = {
        module: class ConfigModule {},
        providers: [
          {
            provide: CONFIG_TOKEN,
            useValue: mockConfig,
          },
        ],
        exports: [CONFIG_TOKEN],
      };

      const moduleRef = await Test.createTestingModule({
        imports: [
          MastraModule.registerAsync({
            imports: [ConfigModule],
            useFactory: (config: typeof mockConfig) => ({
              mastra: context.mastra,
              prefix: config.prefix,
            }),
            inject: [CONFIG_TOKEN],
          }),
        ],
      }).compile();

      const injectedMastra = moduleRef.get(MASTRA);
      expect(injectedMastra).toBe(context.mastra);

      const service = moduleRef.get(MastraService);
      expect(service.getOptions().prefix).toBe('/api/v2');
    });
  });

  describe('Injection in Services', () => {
    it('should allow injection of MASTRA token in custom services', async () => {
      @Injectable()
      class TestService {
        constructor(@Inject(MASTRA) public mastra: Mastra) {}
      }

      const moduleRef = await Test.createTestingModule({
        imports: [MastraModule.register({ mastra: context.mastra })],
        providers: [TestService],
      }).compile();

      const testService = moduleRef.get(TestService);
      expect(testService.mastra).toBe(context.mastra);
    });

    it('should allow injection of MastraService in custom services', async () => {
      // Define TestService with explicit injection to avoid decorator metadata issues with esbuild
      @Injectable()
      class TestService {
        constructor(@Inject(MastraService) public mastraService: MastraService) {}
      }

      const moduleRef = await Test.createTestingModule({
        imports: [MastraModule.register({ mastra: context.mastra })],
        providers: [TestService],
      }).compile();

      const testService = moduleRef.get(TestService);
      expect(testService.mastraService).toBeInstanceOf(MastraService);
      expect(testService.mastraService.getMastra()).toBe(context.mastra);
    });
  });

  describe('Controller-based routing', () => {
    it('should register routes via controllers on app init', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [
          MastraModule.register({
            mastra: context.mastra,
          }),
        ],
      }).compile();

      const app = moduleRef.createNestApplication();

      // Add JSON middleware
      const expressApp = app.getHttpAdapter().getInstance() as Application;
      expressApp.use(express.json());

      // Init triggers controller registration
      await app.init();

      // Verify routes are registered without binding to a port
      const response = await executeExpressRequest(expressApp, {
        method: 'GET',
        path: '/agents',
      });
      expect(response.status).toBe(200);

      await app.close();
    });

    it('should register routes with custom prefix', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [
          MastraModule.register({
            mastra: context.mastra,
            prefix: '/api',
          }),
        ],
      }).compile();

      const app = moduleRef.createNestApplication();
      app.setGlobalPrefix('api');
      const expressApp = app.getHttpAdapter().getInstance() as Application;
      expressApp.use(express.json());

      await app.init();

      // Routes should be accessible under /api prefix
      const response = await executeExpressRequest(expressApp, {
        method: 'GET',
        path: '/api/agents',
      });
      expect(response.status).toBe(200);

      await app.close();
    });
  });

  describe('Health endpoints', () => {
    it('should provide health check endpoint', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [MastraModule.register({ mastra: context.mastra })],
      }).compile();

      const app = moduleRef.createNestApplication();
      const expressApp = app.getHttpAdapter().getInstance() as Application;
      expressApp.use(express.json());

      await app.init();

      const response = await executeExpressRequest(expressApp, {
        method: 'GET',
        path: '/health',
      });
      expect(response.status).toBe(200);
      expect((response.body as any).status).toBe('ok');
      expect((response.body as any).timestamp).toBeDefined();

      await app.close();
    });

    it('should provide ready endpoint', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [MastraModule.register({ mastra: context.mastra })],
      }).compile();

      const app = moduleRef.createNestApplication();
      const expressApp = app.getHttpAdapter().getInstance() as Application;
      expressApp.use(express.json());

      await app.init();

      const response = await executeExpressRequest(expressApp, {
        method: 'GET',
        path: '/ready',
      });
      expect(response.status).toBe(200);
      expect((response.body as any).ready).toBe(true);
      expect((response.body as any).activeRequests).toBe(0);

      await app.close();
    });
  });

  describe('Module exports', () => {
    it('should export MASTRA and MastraService', async () => {
      // Create a consumer module that imports MastraModule
      // Use explicit @Inject decorators to avoid decorator metadata issues with esbuild
      @Injectable()
      class ConsumerService {
        constructor(
          @Inject(MASTRA) public mastra: Mastra,
          @Inject(MastraService) public mastraService: MastraService,
        ) {}
      }

      const moduleRef = await Test.createTestingModule({
        imports: [MastraModule.register({ mastra: context.mastra })],
        providers: [ConsumerService],
      }).compile();

      const consumer = moduleRef.get(ConsumerService);
      expect(consumer.mastra).toBe(context.mastra);
      expect(consumer.mastraService).toBeInstanceOf(MastraService);
    });
  });

  describe('Rate limiting', () => {
    it('should be enabled by default', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [MastraModule.register({ mastra: context.mastra })],
      }).compile();

      const options = moduleRef.get(MASTRA_OPTIONS);
      // Rate limiting is enabled by default (no explicit enabled: false)
      expect(options.rateLimitOptions?.enabled).not.toBe(false);
    });

    it('should respect disabled rate limiting option', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [
          MastraModule.register({
            mastra: context.mastra,
            rateLimitOptions: { enabled: false },
          }),
        ],
      }).compile();

      const options = moduleRef.get(MASTRA_OPTIONS);
      expect(options.rateLimitOptions?.enabled).toBe(false);
    });
  });

  describe('Info endpoint', () => {
    it('should provide info endpoint with version and prefix', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [
          MastraModule.register({
            mastra: context.mastra,
            prefix: '/api/v1',
          }),
        ],
      }).compile();

      const app = moduleRef.createNestApplication();
      const expressApp = app.getHttpAdapter().getInstance() as Application;
      expressApp.use(express.json());

      await app.init();

      const response = await executeExpressRequest(expressApp, {
        method: 'GET',
        path: '/info',
      });
      expect(response.status).toBe(200);
      expect((response.body as any).prefix).toBe('/api/v1');
      expect((response.body as any).timestamp).toBeDefined();

      await app.close();
    });
  });

  describe('Graceful Shutdown', () => {
    it('should track shutdown state via ShutdownService', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [MastraModule.register({ mastra: context.mastra })],
      }).compile();

      const shutdownService = moduleRef.get(ShutdownService);

      // Initially not shutting down
      expect(shutdownService.shuttingDown).toBe(false);

      // Track active requests - registerRequest takes a path and returns a requestId
      const requestId = shutdownService.registerRequest('/test/path');
      expect(shutdownService.activeRequestCount).toBe(1);

      shutdownService.completeRequest(requestId);
      expect(shutdownService.activeRequestCount).toBe(0);
    });

    it('should track shutdown state via MastraService', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [MastraModule.register({ mastra: context.mastra })],
      }).compile();

      const app = moduleRef.createNestApplication();
      await app.init();

      const mastraService = moduleRef.get(MastraService);

      // Initially not shutting down
      expect(mastraService.isShuttingDown).toBe(false);

      await app.close();
    });

    it('should report shutting_down status in health endpoint during shutdown', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [MastraModule.register({ mastra: context.mastra })],
      }).compile();

      const app = moduleRef.createNestApplication();
      const expressApp = app.getHttpAdapter().getInstance() as Application;
      expressApp.use(express.json());

      await app.init();

      const shutdownService = moduleRef.get(ShutdownService);

      // Manually trigger shutdown state (isShuttingDown is private)
      (shutdownService as any).isShuttingDown = true;

      const response = await executeExpressRequest(expressApp, {
        method: 'GET',
        path: '/health',
      });
      expect(response.status).toBe(503);
      expect((response.body as any).status).toBe('shutting_down');

      await app.close();
    });
  });

  describe('Error responses', () => {
    it('should return 404 for non-existent routes', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [MastraModule.register({ mastra: context.mastra })],
      }).compile();

      const app = moduleRef.createNestApplication();
      const expressApp = app.getHttpAdapter().getInstance() as Application;
      expressApp.use(express.json());

      await app.init();

      const response = await executeExpressRequest(expressApp, {
        method: 'GET',
        path: '/non-existent-route',
      });
      expect(response.status).toBe(404);

      await app.close();
    });

    it('should return 404 for non-existent agent', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [MastraModule.register({ mastra: context.mastra })],
      }).compile();

      const app = moduleRef.createNestApplication();
      const expressApp = app.getHttpAdapter().getInstance() as Application;
      expressApp.use(express.json());

      await app.init();

      const response = await executeExpressRequest(expressApp, {
        method: 'GET',
        path: '/agents/non-existent-agent',
      });
      expect(response.status).toBe(404);

      await app.close();
    });

    it('should return structured error response format', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [MastraModule.register({ mastra: context.mastra })],
      }).compile();

      const app = moduleRef.createNestApplication();
      const expressApp = app.getHttpAdapter().getInstance() as Application;
      expressApp.use(express.json());

      await app.init();

      const response = await executeExpressRequest(expressApp, {
        method: 'GET',
        path: '/agents/non-existent-agent',
      });
      expect(response.status).toBe(404);

      const body = response.body as any;
      // Error response should have structured format
      expect(body.error).toBeDefined();
      expect(body.timestamp).toBeDefined();

      await app.close();
    });
  });

  describe('Body limit options', () => {
    it('should accept body limit options', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [
          MastraModule.register({
            mastra: context.mastra,
            bodyLimitOptions: {
              maxSize: 10 * 1024 * 1024,
              maxFileSize: 5 * 1024 * 1024,
            },
          }),
        ],
      }).compile();

      const options = moduleRef.get(MASTRA_OPTIONS);
      expect(options.bodyLimitOptions?.maxSize).toBe(10 * 1024 * 1024);
      expect(options.bodyLimitOptions?.maxFileSize).toBe(5 * 1024 * 1024);
    });
  });

  describe('Stream options', () => {
    it('should accept stream options', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [
          MastraModule.register({
            mastra: context.mastra,
            streamOptions: {
              redact: false,
              heartbeatMs: 30000,
            },
          }),
        ],
      }).compile();

      const options = moduleRef.get(MASTRA_OPTIONS);
      expect(options.streamOptions?.redact).toBe(false);
      expect(options.streamOptions?.heartbeatMs).toBe(30000);
    });
  });

  describe('Shutdown options', () => {
    it('should accept shutdown options', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [
          MastraModule.register({
            mastra: context.mastra,
            shutdownOptions: {
              timeoutMs: 60000,
            },
          }),
        ],
      }).compile();

      const options = moduleRef.get(MASTRA_OPTIONS);
      expect(options.shutdownOptions?.timeoutMs).toBe(60000);
    });
  });

  describe('Tools configuration', () => {
    it('should accept tools configuration', async () => {
      const testTools = {
        customTool: {
          name: 'customTool',
          description: 'A custom tool',
          execute: async () => ({ result: 'success' }),
        },
      };

      const moduleRef = await Test.createTestingModule({
        imports: [
          MastraModule.register({
            mastra: context.mastra,
            tools: testTools as any,
          }),
        ],
      }).compile();

      const options = moduleRef.get(MASTRA_OPTIONS);
      expect(options.tools).toBe(testTools);
    });
  });
});
