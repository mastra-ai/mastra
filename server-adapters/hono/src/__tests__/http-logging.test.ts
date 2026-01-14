import { Mastra } from '@mastra/core/mastra';
import { Hono } from 'hono';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MastraServer } from '../index';

describe('Hono HTTP Logging', () => {
  let app: Hono;
  let mastra: Mastra;
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    app = new Hono();
    vi.clearAllMocks();
  });

  it('should not log when apiReqLogs is disabled', async () => {
    mastra = new Mastra({});
    const adapter = new MastraServer({ app, mastra });

    logSpy = vi.spyOn(adapter.logger, 'info');

    await adapter.init();

    // Make a test request
    const response = await app.request(new Request('http://localhost/test', { method: 'GET' }));

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

    // Add a test route after init (Hono allows this)
    app.get('/test', c => c.json({ message: 'success' }));

    // Make a test request
    const response = await app.request(new Request('http://localhost/test', { method: 'GET' }));

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

    // Add a test route
    app.get('/test', c => c.json({ message: 'success' }));

    await adapter.init();

    // Make a test request
    await app.request(new Request('http://localhost/test', { method: 'GET' }));

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

    // Add test routes
    app.get('/health', c => c.json({ status: 'ok' }));
    app.get('/test', c => c.json({ message: 'success' }));

    await adapter.init();

    // Make requests
    await app.request(new Request('http://localhost/health', { method: 'GET' }));
    await app.request(new Request('http://localhost/test', { method: 'GET' }));

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

    // Add a test route
    app.get('/test', c => c.json({ message: 'success' }));

    await adapter.init();

    // Make a request with query params
    await app.request(new Request('http://localhost/test?foo=bar&baz=qux', { method: 'GET' }));

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

    // Add a test route
    app.get('/test', c => c.json({ message: 'success' }));

    await adapter.init();

    // Make a request with headers
    await app.request(
      new Request('http://localhost/test', {
        method: 'GET',
        headers: {
          'x-custom-header': 'custom-value',
          'user-agent': 'test-client',
        },
      }),
    );

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

    // Add a test route
    app.get('/test', c => c.json({ message: 'success' }));

    await adapter.init();

    // Make a request with sensitive headers
    await app.request(
      new Request('http://localhost/test', {
        method: 'GET',
        headers: {
          authorization: 'Bearer secret-token',
          cookie: 'session=secret-session',
          'x-custom': 'not-sensitive',
        },
      }),
    );

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

    // Add a test route
    app.get('/test', c => c.json({ message: 'success' }));

    await adapter.init();

    // Make a request with custom sensitive headers
    await app.request(
      new Request('http://localhost/test', {
        method: 'GET',
        headers: {
          'x-api-key': 'secret-key',
          'x-secret': 'secret-value',
          authorization: 'Bearer token', // Should NOT be redacted with custom config
        },
      }),
    );

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

    // Add test routes
    app.get('/test', c => c.json({ message: 'get' }));
    app.post('/test', c => c.json({ message: 'post' }));
    app.put('/test', c => c.json({ message: 'put' }));
    app.delete('/test', c => c.json({ message: 'delete' }));

    await adapter.init();

    // Make requests with different methods
    await app.request(new Request('http://localhost/test', { method: 'GET' }));
    await app.request(new Request('http://localhost/test', { method: 'POST', body: '{}' }));
    await app.request(new Request('http://localhost/test', { method: 'PUT', body: '{}' }));
    await app.request(new Request('http://localhost/test', { method: 'DELETE' }));

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

    // Add routes with different status codes
    app.get('/not-found', c => c.json({ error: 'Not found' }, 404));
    app.get('/error', c => c.json({ error: 'Internal error' }, 500));

    await adapter.init();

    // Make requests
    await app.request(new Request('http://localhost/not-found', { method: 'GET' }));
    await app.request(new Request('http://localhost/error', { method: 'GET' }));

    expect(logSpy).toHaveBeenCalledWith(expect.stringMatching(/GET \/not-found 404/), expect.any(Object));
    expect(logSpy).toHaveBeenCalledWith(expect.stringMatching(/GET \/error 500/), expect.any(Object));
  });
});
