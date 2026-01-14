import { Mastra } from '@mastra/core/mastra';
import Koa from 'koa';
import request from 'supertest';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MastraServer } from '../index';

describe('Koa HTTP Logging', () => {
  let app: Koa;
  let mastra: Mastra;
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    app = new Koa();
    vi.clearAllMocks();
  });

  it('should not log when apiReqLogs is disabled', async () => {
    mastra = new Mastra({});
    const adapter = new MastraServer({ app, mastra });

    logSpy = vi.spyOn(adapter.logger, 'info');

    await adapter.init();

    // Add a test route
    app.use(ctx => {
      ctx.body = { message: 'success' };
    });

    // Make a test request
    await request(app.callback()).get('/test');

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
    app.use(ctx => {
      ctx.body = { message: 'success' };
    });

    // Make a test request
    const response = await request(app.callback()).get('/test');

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

    await adapter.init();

    // Add a test route
    app.use(ctx => {
      ctx.body = { message: 'success' };
    });

    // Make a test request
    await request(app.callback()).get('/test');

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

    // Add test route
    app.use(ctx => {
      ctx.body = ctx.path === '/health' ? { status: 'ok' } : { message: 'success' };
    });

    // Make requests
    await request(app.callback()).get('/health');
    await request(app.callback()).get('/test');

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
    app.use(ctx => {
      ctx.body = { message: 'success' };
    });

    // Make a request with query params
    await request(app.callback()).get('/test?foo=bar&baz=qux');

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
    app.use(ctx => {
      ctx.body = { message: 'success' };
    });

    // Make a request with headers
    await request(app.callback()).get('/test').set('x-custom-header', 'custom-value').set('user-agent', 'test-client');

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
    app.use(ctx => {
      ctx.body = { message: 'success' };
    });

    // Make a request with sensitive headers
    await request(app.callback())
      .get('/test')
      .set('authorization', 'Bearer secret-token')
      .set('cookie', 'session=secret-session')
      .set('x-custom', 'not-sensitive');

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
    app.use(ctx => {
      ctx.body = { message: 'success' };
    });

    // Make a request with custom sensitive headers
    await request(app.callback())
      .get('/test')
      .set('x-api-key', 'secret-key')
      .set('x-secret', 'secret-value')
      .set('authorization', 'Bearer token');

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

    // Add test route
    app.use(ctx => {
      ctx.body = { message: ctx.method.toLowerCase() };
    });

    // Make requests with different methods
    await request(app.callback()).get('/test');
    await request(app.callback()).post('/test').send({});
    await request(app.callback()).put('/test').send({});
    await request(app.callback()).delete('/test');

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

    // Add route with different status codes
    app.use(ctx => {
      if (ctx.path === '/not-found') {
        ctx.status = 404;
        ctx.body = { error: 'Not found' };
      } else if (ctx.path === '/error') {
        ctx.status = 500;
        ctx.body = { error: 'Internal error' };
      } else {
        ctx.body = { message: 'success' };
      }
    });

    // Make requests
    await request(app.callback()).get('/not-found');
    await request(app.callback()).get('/error');

    expect(logSpy).toHaveBeenCalledWith(expect.stringMatching(/GET \/not-found 404/), expect.any(Object));
    expect(logSpy).toHaveBeenCalledWith(expect.stringMatching(/GET \/error 500/), expect.any(Object));
  });
});
