/**
 * Unit tests for request logger middleware.
 */

import type { Context, Next } from 'hono';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { createMockHonoContext, createMockNext } from '../__tests__/test-utils';
import { createRequestLoggerMiddleware } from './request-logger';

describe('createRequestLoggerMiddleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'info').mockImplementation(() => {});
    // Mock crypto.randomUUID for predictable request IDs
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('test-request-id');
  });

  describe('request ID', () => {
    it('should set requestId in context', async () => {
      const middleware = createRequestLoggerMiddleware();
      const context = createMockHonoContext({
        path: '/api/teams',
      });
      const next = createMockNext();

      await middleware(context as unknown as Context, next as unknown as Next);

      expect(context.set).toHaveBeenCalledWith('requestId', 'test-request-id');
    });

    it('should set X-Request-Id header', async () => {
      const middleware = createRequestLoggerMiddleware();
      const context = createMockHonoContext({
        path: '/api/teams',
      });
      const next = createMockNext();

      await middleware(context as unknown as Context, next as unknown as Next);

      expect(context.header).toHaveBeenCalledWith('X-Request-Id', 'test-request-id');
    });
  });

  describe('skip paths', () => {
    it('should skip /health by default', async () => {
      const middleware = createRequestLoggerMiddleware();
      const context = createMockHonoContext({
        path: '/health',
      });
      const next = createMockNext();

      await middleware(context as unknown as Context, next as unknown as Next);

      expect(console.info).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });

    it('should skip /ready by default', async () => {
      const middleware = createRequestLoggerMiddleware();
      const context = createMockHonoContext({
        path: '/ready',
      });
      const next = createMockNext();

      await middleware(context as unknown as Context, next as unknown as Next);

      expect(console.info).not.toHaveBeenCalled();
    });

    it('should use custom skip paths', async () => {
      const middleware = createRequestLoggerMiddleware({
        skipPaths: ['/custom-skip'],
      });
      const context = createMockHonoContext({
        path: '/custom-skip',
      });
      const next = createMockNext();

      await middleware(context as unknown as Context, next as unknown as Next);

      expect(console.info).not.toHaveBeenCalled();
    });
  });

  describe('logging', () => {
    it('should log request info', async () => {
      const middleware = createRequestLoggerMiddleware();

      // Create a context with response status accessible
      const context = createMockHonoContext({
        path: '/api/teams',
        method: 'GET',
      });
      // Mock res.status to be readable after next()
      (context.res as { status: number }).status = 200;

      const next = createMockNext();

      await middleware(context as unknown as Context, next as unknown as Next);

      expect(console.info).toHaveBeenCalledWith(expect.stringContaining('[test-request-id]'));
      expect(console.info).toHaveBeenCalledWith(expect.stringContaining('GET'));
      expect(console.info).toHaveBeenCalledWith(expect.stringContaining('/api/teams'));
      expect(console.info).toHaveBeenCalledWith(expect.stringContaining('200'));
    });

    it('should include userId when available', async () => {
      const middleware = createRequestLoggerMiddleware();
      const context = createMockHonoContext({
        path: '/api/teams',
        method: 'GET',
        variables: { userId: 'user-123' },
      });
      (context.res as { status: number }).status = 200;
      const next = createMockNext();

      await middleware(context as unknown as Context, next as unknown as Next);

      expect(console.info).toHaveBeenCalledWith(expect.stringContaining('user=user-123'));
    });

    it('should include duration in log', async () => {
      const middleware = createRequestLoggerMiddleware();
      const context = createMockHonoContext({
        path: '/api/teams',
      });
      (context.res as { status: number }).status = 200;
      const next = createMockNext();

      await middleware(context as unknown as Context, next as unknown as Next);

      expect(console.info).toHaveBeenCalledWith(expect.stringMatching(/\d+ms/));
    });
  });

  describe('custom formatter', () => {
    it('should use custom formatter when provided', async () => {
      const customFormatter = vi.fn().mockReturnValue('custom log message');
      const middleware = createRequestLoggerMiddleware({
        formatter: customFormatter,
      });
      const context = createMockHonoContext({
        path: '/api/teams',
        method: 'POST',
      });
      (context.res as { status: number }).status = 201;
      const next = createMockNext();

      await middleware(context as unknown as Context, next as unknown as Next);

      expect(customFormatter).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          path: '/api/teams',
          status: 201,
          requestId: 'test-request-id',
        }),
      );
      expect(console.info).toHaveBeenCalledWith('custom log message');
    });
  });

  describe('log entry fields', () => {
    it('should capture User-Agent header', async () => {
      const customFormatter = vi.fn().mockReturnValue('log');
      const middleware = createRequestLoggerMiddleware({
        formatter: customFormatter,
      });
      const context = createMockHonoContext({
        path: '/api/teams',
        headers: { 'User-Agent': 'Test Browser/1.0' },
      });
      (context.res as { status: number }).status = 200;
      const next = createMockNext();

      await middleware(context as unknown as Context, next as unknown as Next);

      expect(customFormatter).toHaveBeenCalledWith(
        expect.objectContaining({
          userAgent: 'Test Browser/1.0',
        }),
      );
    });

    it('should capture X-Forwarded-For header', async () => {
      const customFormatter = vi.fn().mockReturnValue('log');
      const middleware = createRequestLoggerMiddleware({
        formatter: customFormatter,
      });
      const context = createMockHonoContext({
        path: '/api/teams',
        headers: { 'X-Forwarded-For': '192.168.1.1' },
      });
      (context.res as { status: number }).status = 200;
      const next = createMockNext();

      await middleware(context as unknown as Context, next as unknown as Next);

      expect(customFormatter).toHaveBeenCalledWith(
        expect.objectContaining({
          ip: '192.168.1.1',
        }),
      );
    });

    it('should capture X-Real-IP as fallback', async () => {
      const customFormatter = vi.fn().mockReturnValue('log');
      const middleware = createRequestLoggerMiddleware({
        formatter: customFormatter,
      });
      const context = createMockHonoContext({
        path: '/api/teams',
        headers: { 'X-Real-IP': '10.0.0.1' },
      });
      (context.res as { status: number }).status = 200;
      const next = createMockNext();

      await middleware(context as unknown as Context, next as unknown as Next);

      expect(customFormatter).toHaveBeenCalledWith(
        expect.objectContaining({
          ip: '10.0.0.1',
        }),
      );
    });

    it('should capture teamId from context', async () => {
      const customFormatter = vi.fn().mockReturnValue('log');
      const middleware = createRequestLoggerMiddleware({
        formatter: customFormatter,
      });
      const context = createMockHonoContext({
        path: '/api/teams',
        variables: { teamId: 'team-456' },
      });
      (context.res as { status: number }).status = 200;
      const next = createMockNext();

      await middleware(context as unknown as Context, next as unknown as Next);

      expect(customFormatter).toHaveBeenCalledWith(
        expect.objectContaining({
          teamId: 'team-456',
        }),
      );
    });
  });

  describe('call order', () => {
    it('should call next() and wait for it to complete', async () => {
      const middleware = createRequestLoggerMiddleware();
      const context = createMockHonoContext({
        path: '/api/teams',
      });

      let nextCalled = false;
      const next = vi.fn().mockImplementation(async () => {
        nextCalled = true;
      });

      await middleware(context as unknown as Context, next as unknown as Next);

      expect(nextCalled).toBe(true);
    });
  });
});
