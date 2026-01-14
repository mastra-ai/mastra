import { Mastra } from '@mastra/core/mastra';
import Fastify, { type FastifyInstance } from 'fastify';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { MastraServer } from '../index';

describe('Fastify HTTP Logging', () => {
  let app: FastifyInstance;
  let mastra: Mastra;
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    app = Fastify({ logger: false });
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await app.close();
  });

  it('should not log when apiReqLogs is disabled', async () => {
    mastra = new Mastra({});
    const adapter = new MastraServer({ app, mastra });

    logSpy = vi.spyOn(adapter.logger, 'info');

    await adapter.init();

    // Add a test route
    app.get('/test', async () => ({ message: 'success' }));

    // Make a test request
    await app.inject({
      method: 'GET',
      url: '/test',
    });

    expect(logSpy).not.toHaveBeenCalled();
  });

  it('should log HTTP requests when enabled with default config', async () => {
    mastra = new Mastra({
      server: {
        build: {
          apiReqLogs: true,
        },
      },
    });
    const adapter = new MastraServer({ app, mastra });

    logSpy = vi.spyOn(adapter.logger, 'info');

    await adapter.init();

    // Add a test route
    app.get('/test', async () => ({ message: 'success' }));

    // Make a test request
    const response = await app.inject({
      method: 'GET',
      url: '/test',
    });

    expect(response.statusCode).toBe(200);
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
    mastra = new Mastra({
      server: {
        build: {
          apiReqLogs: {
            enabled: true,
            level: 'debug',
          },
        },
      },
    });
    const adapter = new MastraServer({ app, mastra });

    const debugSpy = vi.spyOn(adapter.logger, 'debug');

    await adapter.init();

    // Add a test route
    app.get('/test', async () => ({ message: 'success' }));

    // Make a test request
    await app.inject({
      method: 'GET',
      url: '/test',
    });

    expect(debugSpy).toHaveBeenCalledWith(expect.stringMatching(/GET \/test 200 \d+ms/), expect.any(Object));
  });

  it('should exclude paths from logging', async () => {
    mastra = new Mastra({
      server: {
        build: {
          apiReqLogs: {
            enabled: true,
            excludePaths: ['/health', '/ready'],
          },
        },
      },
    });
    const adapter = new MastraServer({ app, mastra });

    logSpy = vi.spyOn(adapter.logger, 'info');

    await adapter.init();

    // Add test routes
    app.get('/health', async () => ({ status: 'ok' }));
    app.get('/test', async () => ({ message: 'success' }));

    // Make requests
    await app.inject({ method: 'GET', url: '/health' });
    await app.inject({ method: 'GET', url: '/test' });

    // Only /test should be logged
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith(expect.stringMatching(/GET \/test 200/), expect.any(Object));
  });

  it('should include query params when configured', async () => {
    mastra = new Mastra({
      server: {
        build: {
          apiReqLogs: {
            enabled: true,
            includeQueryParams: true,
          },
        },
      },
    });
    const adapter = new MastraServer({ app, mastra });

    logSpy = vi.spyOn(adapter.logger, 'info');

    await adapter.init();

    // Add a test route
    app.get('/test', async () => ({ message: 'success' }));

    // Make a request with query params
    await app.inject({
      method: 'GET',
      url: '/test?foo=bar&baz=qux',
    });

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
    mastra = new Mastra({
      server: {
        build: {
          apiReqLogs: {
            enabled: true,
            includeHeaders: true,
          },
        },
      },
    });
    const adapter = new MastraServer({ app, mastra });

    logSpy = vi.spyOn(adapter.logger, 'info');

    await adapter.init();

    // Add a test route
    app.get('/test', async () => ({ message: 'success' }));

    // Make a request with headers
    await app.inject({
      method: 'GET',
      url: '/test',
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
    mastra = new Mastra({
      server: {
        build: {
          apiReqLogs: {
            enabled: true,
            includeHeaders: true,
          },
        },
      },
    });
    const adapter = new MastraServer({ app, mastra });

    logSpy = vi.spyOn(adapter.logger, 'info');

    await adapter.init();

    // Add a test route
    app.get('/test', async () => ({ message: 'success' }));

    // Make a request with sensitive headers
    await app.inject({
      method: 'GET',
      url: '/test',
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
    mastra = new Mastra({
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
    const adapter = new MastraServer({ app, mastra });

    logSpy = vi.spyOn(adapter.logger, 'info');

    await adapter.init();

    // Add a test route
    app.get('/test', async () => ({ message: 'success' }));

    // Make a request with custom sensitive headers
    await app.inject({
      method: 'GET',
      url: '/test',
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
          authorization: 'Bearer token', // Not in custom redact list
        }),
      }),
    );
  });

  it('should log different HTTP methods', async () => {
    mastra = new Mastra({
      server: {
        build: {
          apiReqLogs: true,
        },
      },
    });
    const adapter = new MastraServer({ app, mastra });

    logSpy = vi.spyOn(adapter.logger, 'info');

    await adapter.init();

    // Add test routes
    app.get('/test', async () => ({ message: 'get' }));
    app.post('/test', async () => ({ message: 'post' }));
    app.put('/test', async () => ({ message: 'put' }));
    app.delete('/test', async () => ({ message: 'delete' }));

    // Make requests with different methods
    await app.inject({ method: 'GET', url: '/test' });
    await app.inject({ method: 'POST', url: '/test', payload: {} });
    await app.inject({ method: 'PUT', url: '/test', payload: {} });
    await app.inject({ method: 'DELETE', url: '/test' });

    expect(logSpy).toHaveBeenCalledTimes(4);
    expect(logSpy).toHaveBeenCalledWith(expect.stringMatching(/GET \/test 200/), expect.any(Object));
    expect(logSpy).toHaveBeenCalledWith(expect.stringMatching(/POST \/test 200/), expect.any(Object));
    expect(logSpy).toHaveBeenCalledWith(expect.stringMatching(/PUT \/test 200/), expect.any(Object));
    expect(logSpy).toHaveBeenCalledWith(expect.stringMatching(/DELETE \/test 200/), expect.any(Object));
  });

  it('should log error status codes', async () => {
    mastra = new Mastra({
      server: {
        build: {
          apiReqLogs: true,
        },
      },
    });
    const adapter = new MastraServer({ app, mastra });

    logSpy = vi.spyOn(adapter.logger, 'info');

    await adapter.init();

    // Add routes with different status codes
    app.get('/not-found', async (_req, reply) => {
      reply.status(404).send({ error: 'Not found' });
    });
    app.get('/error', async (_req, reply) => {
      reply.status(500).send({ error: 'Internal error' });
    });

    // Make requests
    await app.inject({ method: 'GET', url: '/not-found' });
    await app.inject({ method: 'GET', url: '/error' });

    expect(logSpy).toHaveBeenCalledWith(expect.stringMatching(/GET \/not-found 404/), expect.any(Object));
    expect(logSpy).toHaveBeenCalledWith(expect.stringMatching(/GET \/error 500/), expect.any(Object));
  });
});
