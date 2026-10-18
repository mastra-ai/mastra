import { Mastra } from '@mastra/core/mastra';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { AdapterTestContext } from './test-helpers';
import { createDefaultTestContext } from './test-helpers';

/**
 * Configuration for HTTP logging test suite
 */
export interface HttpLoggingTestSuiteConfig<TApp> {
  /** Name for the test suite */
  suiteName?: string;

  /**
   * Setup adapter with given Mastra instance
   */
  setupAdapter: (app: TApp, mastra: Mastra) => { adapter: any; app: TApp } | Promise<{ adapter: any; app: TApp }>;

  /**
   * Create a new app instance
   */
  createApp: () => TApp;

  /**
   * Register a route handler for testing
   * Returns a function to register the route (called after init for some adapters)
   */
  addRoute: (
    app: TApp,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    handler: (req: any) => any | Promise<any>,
  ) => void | Promise<void>;

  /**
   * Execute an HTTP request against the app
   */
  executeRequest: (
    app: TApp,
    method: string,
    url: string,
    options?: { headers?: Record<string, string>; body?: string },
  ) => Promise<{ status: number }>;
}

/**
 * Creates a standardized test suite for HTTP logging across all server adapters.
 *
 * Tests:
 * - Disabled logging (no logs when apiReqLogs is false)
 * - Default logging (info level with basic fields)
 * - Custom log levels (debug, info, warn)
 * - Path exclusion (health checks, metrics)
 * - Query parameter inclusion
 * - Header inclusion
 * - Sensitive header redaction (default and custom)
 * - Different HTTP methods (GET, POST, PUT, DELETE)
 * - Error status codes (404, 500)
 */
export function createHttpLoggingTestSuite<TApp>(config: HttpLoggingTestSuiteConfig<TApp>) {
  const { suiteName = 'HTTP Logging', setupAdapter, createApp, addRoute, executeRequest } = config;

  describe(suiteName, () => {
    let app: TApp;
    let logSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      app = createApp();
      vi.clearAllMocks();
    });

    it('should not log when apiReqLogs is disabled', async () => {
      const mastra = new Mastra({});
      const { adapter } = await setupAdapter(app, mastra);

      logSpy = vi.spyOn(adapter.logger, 'info');

      await adapter.init();

      await addRoute(app, 'GET', '/test', () => ({ message: 'success' }));

      await executeRequest(app, 'GET', 'http://localhost/test');

      expect(logSpy).not.toHaveBeenCalled();
    });

    it('should log HTTP requests when enabled with default config', async () => {
      const mastra = new Mastra({
        server: {
          build: {
            apiReqLogs: true,
          },
        },
      });
      const { adapter } = await setupAdapter(app, mastra);

      logSpy = vi.spyOn(adapter.logger, 'info');

      await adapter.init();

      await addRoute(app, 'GET', '/test', () => ({ message: 'success' }));

      const response = await executeRequest(app, 'GET', 'http://localhost/test');

      expect(response.status).toBe(200);
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringMatching(/GET \/test 200 \d+ms/),
        expect.objectContaining({
          method: 'GET',
          path: '/test',
          status: 200,
          duration: expect.stringMatching(/\d+ms/),
        }),
      );
    });

    it('should use custom log level', async () => {
      const mastra = new Mastra({
        server: {
          build: {
            apiReqLogs: {
              enabled: true,
              level: 'debug',
            },
          },
        },
      });
      const { adapter } = await setupAdapter(app, mastra);

      const debugSpy = vi.spyOn(adapter.logger, 'debug');

      await adapter.init();

      await addRoute(app, 'GET', '/test', () => ({ message: 'success' }));

      await executeRequest(app, 'GET', 'http://localhost/test');

      expect(debugSpy).toHaveBeenCalledWith(expect.stringMatching(/GET \/test 200 \d+ms/), expect.any(Object));
    });

    it('should exclude paths from logging', async () => {
      const mastra = new Mastra({
        server: {
          build: {
            apiReqLogs: {
              enabled: true,
              excludePaths: ['/health', '/ready'],
            },
          },
        },
      });
      const { adapter } = await setupAdapter(app, mastra);

      logSpy = vi.spyOn(adapter.logger, 'info');

      await adapter.init();

      await addRoute(app, 'GET', '/health', () => ({ status: 'ok' }));
      await addRoute(app, 'GET', '/test', () => ({ message: 'success' }));

      await executeRequest(app, 'GET', 'http://localhost/health');
      await executeRequest(app, 'GET', 'http://localhost/test');

      expect(logSpy).toHaveBeenCalledTimes(1);
      expect(logSpy).toHaveBeenCalledWith(expect.stringMatching(/GET \/test 200/), expect.any(Object));
    });

    it('should include query params when configured', async () => {
      const mastra = new Mastra({
        server: {
          build: {
            apiReqLogs: {
              enabled: true,
              includeQueryParams: true,
            },
          },
        },
      });
      const { adapter } = await setupAdapter(app, mastra);

      logSpy = vi.spyOn(adapter.logger, 'info');

      await adapter.init();

      await addRoute(app, 'GET', '/test', () => ({ message: 'success' }));

      await executeRequest(app, 'GET', 'http://localhost/test?foo=bar&baz=qux');

      expect(logSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          query: expect.objectContaining({
            foo: 'bar',
            baz: 'qux',
          }),
        }),
      );
    });

    it('should include headers when configured', async () => {
      const mastra = new Mastra({
        server: {
          build: {
            apiReqLogs: {
              enabled: true,
              includeHeaders: true,
            },
          },
        },
      });
      const { adapter } = await setupAdapter(app, mastra);

      logSpy = vi.spyOn(adapter.logger, 'info');

      await adapter.init();

      await addRoute(app, 'GET', '/test', () => ({ message: 'success' }));

      await executeRequest(app, 'GET', 'http://localhost/test', {
        headers: {
          'x-custom-header': 'custom-value',
          'user-agent': 'test-client',
        },
      });

      expect(logSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'x-custom-header': 'custom-value',
            'user-agent': 'test-client',
          }),
        }),
      );
    });

    it('should redact sensitive headers by default', async () => {
      const mastra = new Mastra({
        server: {
          build: {
            apiReqLogs: {
              enabled: true,
              includeHeaders: true,
            },
          },
        },
      });
      const { adapter } = await setupAdapter(app, mastra);

      logSpy = vi.spyOn(adapter.logger, 'info');

      await adapter.init();

      await addRoute(app, 'GET', '/test', () => ({ message: 'success' }));

      await executeRequest(app, 'GET', 'http://localhost/test', {
        headers: {
          authorization: 'Bearer secret-token',
          cookie: 'session=secret-session',
          'x-custom': 'not-sensitive',
        },
      });

      expect(logSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            authorization: '[REDACTED]',
            cookie: '[REDACTED]',
            'x-custom': 'not-sensitive',
          }),
        }),
      );
    });

    it('should support custom redactHeaders', async () => {
      const mastra = new Mastra({
        server: {
          build: {
            apiReqLogs: {
              enabled: true,
              includeHeaders: true,
              redactHeaders: ['x-api-key', 'x-secret'],
            },
          },
        },
      });
      const { adapter } = await setupAdapter(app, mastra);

      logSpy = vi.spyOn(adapter.logger, 'info');

      await adapter.init();

      await addRoute(app, 'GET', '/test', () => ({ message: 'success' }));

      await executeRequest(app, 'GET', 'http://localhost/test', {
        headers: {
          'x-api-key': 'secret-key',
          'x-secret': 'secret-value',
          authorization: 'Bearer token',
        },
      });

      expect(logSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'x-api-key': '[REDACTED]',
            'x-secret': '[REDACTED]',
            authorization: '[REDACTED]', // Defaults are always merged with custom redact list
          }),
        }),
      );
    });

    it('should log different HTTP methods', async () => {
      const mastra = new Mastra({
        server: {
          build: {
            apiReqLogs: true,
          },
        },
      });
      const { adapter } = await setupAdapter(app, mastra);

      logSpy = vi.spyOn(adapter.logger, 'info');

      await adapter.init();

      await addRoute(app, 'GET', '/test', () => ({ message: 'get' }));
      await addRoute(app, 'POST', '/test', () => ({ message: 'post' }));
      await addRoute(app, 'PUT', '/test', () => ({ message: 'put' }));
      await addRoute(app, 'DELETE', '/test', () => ({ message: 'delete' }));

      await executeRequest(app, 'GET', 'http://localhost/test');
      await executeRequest(app, 'POST', 'http://localhost/test', { body: '{}' });
      await executeRequest(app, 'PUT', 'http://localhost/test', { body: '{}' });
      await executeRequest(app, 'DELETE', 'http://localhost/test');

      expect(logSpy).toHaveBeenCalledTimes(4);
      expect(logSpy).toHaveBeenCalledWith(expect.stringMatching(/GET \/test 200/), expect.any(Object));
      expect(logSpy).toHaveBeenCalledWith(expect.stringMatching(/POST \/test 200/), expect.any(Object));
      expect(logSpy).toHaveBeenCalledWith(expect.stringMatching(/PUT \/test 200/), expect.any(Object));
      expect(logSpy).toHaveBeenCalledWith(expect.stringMatching(/DELETE \/test 200/), expect.any(Object));
    });

    it('should log error status codes', async () => {
      const mastra = new Mastra({
        server: {
          build: {
            apiReqLogs: true,
          },
        },
      });
      const { adapter } = await setupAdapter(app, mastra);

      logSpy = vi.spyOn(adapter.logger, 'info');

      await adapter.init();

      await addRoute(app, 'GET', '/not-found', () => ({ status: 404, body: { error: 'Not found' } }));
      await addRoute(app, 'GET', '/error', () => ({ status: 500, body: { error: 'Internal error' } }));

      await executeRequest(app, 'GET', 'http://localhost/not-found');
      await executeRequest(app, 'GET', 'http://localhost/error');

      expect(logSpy).toHaveBeenCalledWith(expect.stringMatching(/GET \/not-found 404/), expect.any(Object));
      expect(logSpy).toHaveBeenCalledWith(expect.stringMatching(/GET \/error 500/), expect.any(Object));
    });
  });
}
