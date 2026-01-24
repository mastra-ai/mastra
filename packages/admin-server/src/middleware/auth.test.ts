/**
 * Unit tests for auth middleware.
 */

import type { Context, Next } from 'hono';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { createMockMastraAdmin, createMockHonoContext, createMockNext } from '../__tests__/test-utils';
import { createAuthMiddleware } from './auth';

describe('createAuthMiddleware', () => {
  let mockAdmin: ReturnType<typeof createMockMastraAdmin>;
  let middleware: ReturnType<typeof createAuthMiddleware>;

  beforeEach(() => {
    mockAdmin = createMockMastraAdmin();
    middleware = createAuthMiddleware(mockAdmin);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('public paths', () => {
    it('should skip auth for /health endpoint', async () => {
      const context = createMockHonoContext({
        path: '/health',
        variables: { basePath: '/api' },
      });
      const next = createMockNext();

      await middleware(context as unknown as Context, next as unknown as Next);

      expect(next).toHaveBeenCalled();
      // Auth provider should not be called
      expect(mockAdmin.getAuth().validateToken).not.toHaveBeenCalled();
    });

    it('should skip auth for /ready endpoint', async () => {
      const context = createMockHonoContext({
        path: '/ready',
        variables: { basePath: '/api' },
      });
      const next = createMockNext();

      await middleware(context as unknown as Context, next as unknown as Next);

      expect(next).toHaveBeenCalled();
    });

    it('should skip auth for /api/auth/login endpoint', async () => {
      const context = createMockHonoContext({
        path: '/api/auth/login',
        variables: { basePath: '/api' },
      });
      const next = createMockNext();

      await middleware(context as unknown as Context, next as unknown as Next);

      expect(next).toHaveBeenCalled();
    });

    it('should skip auth for /api/auth/refresh endpoint', async () => {
      const context = createMockHonoContext({
        path: '/api/auth/refresh',
        variables: { basePath: '/api' },
      });
      const next = createMockNext();

      await middleware(context as unknown as Context, next as unknown as Next);

      expect(next).toHaveBeenCalled();
    });

    it('should skip auth for invite accept paths with params', async () => {
      const context = createMockHonoContext({
        path: '/api/invites/abc123/accept',
        variables: { basePath: '/api' },
      });
      const next = createMockNext();

      await middleware(context as unknown as Context, next as unknown as Next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('protected paths', () => {
    it('should return 401 when no token is provided', async () => {
      const context = createMockHonoContext({
        path: '/api/teams',
        variables: { basePath: '/api' },
      });
      const next = createMockNext();

      const response = await middleware(context as unknown as Context, next as unknown as Next);

      expect(next).not.toHaveBeenCalled();
      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error).toBe('Authentication required');
    });

    it('should extract token from Authorization header', async () => {
      const context = createMockHonoContext({
        path: '/api/teams',
        headers: { Authorization: 'Bearer test-token' },
        variables: { basePath: '/api' },
      });
      const next = createMockNext();

      await middleware(context as unknown as Context, next as unknown as Next);

      expect(mockAdmin.getAuth().validateToken).toHaveBeenCalledWith('test-token');
    });

    it('should extract token from query param', async () => {
      const context = createMockHonoContext({
        path: '/api/teams',
        query: { token: 'query-token' },
        variables: { basePath: '/api' },
      });
      const next = createMockNext();

      await middleware(context as unknown as Context, next as unknown as Next);

      expect(mockAdmin.getAuth().validateToken).toHaveBeenCalledWith('query-token');
    });

    it('should extract token from cookie', async () => {
      const context = createMockHonoContext({
        path: '/api/teams',
        headers: { Cookie: 'auth_token=cookie-token; other=value' },
        variables: { basePath: '/api' },
      });
      const next = createMockNext();

      await middleware(context as unknown as Context, next as unknown as Next);

      expect(mockAdmin.getAuth().validateToken).toHaveBeenCalledWith('cookie-token');
    });

    it('should return 401 when token is invalid', async () => {
      mockAdmin.getAuth().validateToken = vi.fn().mockResolvedValue(null);

      const context = createMockHonoContext({
        path: '/api/teams',
        headers: { Authorization: 'Bearer invalid-token' },
        variables: { basePath: '/api' },
      });
      const next = createMockNext();

      const response = await middleware(context as unknown as Context, next as unknown as Next);

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error).toBe('Invalid or expired token');
    });

    it('should set user and userId in context on successful auth', async () => {
      const context = createMockHonoContext({
        path: '/api/teams',
        headers: { Authorization: 'Bearer valid-token' },
        variables: { basePath: '/api' },
      });
      const next = createMockNext();

      await middleware(context as unknown as Context, next as unknown as Next);

      expect(context.set).toHaveBeenCalledWith('userId', 'user-123');
      expect(context.set).toHaveBeenCalledWith('user', expect.objectContaining({ id: 'user-123' }));
      expect(next).toHaveBeenCalled();
    });

    it('should return 401 when auth provider throws error', async () => {
      mockAdmin.getAuth().validateToken = vi.fn().mockRejectedValue(new Error('Auth service unavailable'));

      const context = createMockHonoContext({
        path: '/api/teams',
        headers: { Authorization: 'Bearer test-token' },
        variables: { basePath: '/api' },
      });
      const next = createMockNext();

      const response = await middleware(context as unknown as Context, next as unknown as Next);

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error).toBe('Authentication failed');
    });
  });

  describe('no auth provider', () => {
    it('should skip validation when auth provider is not configured', async () => {
      mockAdmin.getAuth = vi.fn().mockReturnValue(undefined);

      const context = createMockHonoContext({
        path: '/api/teams',
        headers: { Authorization: 'Bearer test-token' },
        variables: { basePath: '/api' },
      });
      const next = createMockNext();

      await middleware(context as unknown as Context, next as unknown as Next);

      expect(next).toHaveBeenCalled();
    });

    it('should skip validation when validateToken is not defined', async () => {
      mockAdmin.getAuth = vi.fn().mockReturnValue({});

      const context = createMockHonoContext({
        path: '/api/teams',
        headers: { Authorization: 'Bearer test-token' },
        variables: { basePath: '/api' },
      });
      const next = createMockNext();

      await middleware(context as unknown as Context, next as unknown as Next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('custom configuration', () => {
    it('should use custom public paths', async () => {
      const customMiddleware = createAuthMiddleware(mockAdmin, {
        publicPaths: ['/custom-public'],
      });

      const context = createMockHonoContext({
        path: '/api/custom-public',
        variables: { basePath: '/api' },
      });
      const next = createMockNext();

      await customMiddleware(context as unknown as Context, next as unknown as Next);

      expect(next).toHaveBeenCalled();
    });

    it('should use custom token extractor', async () => {
      const customMiddleware = createAuthMiddleware(mockAdmin, {
        extractToken: c => c.req.header('X-Custom-Token'),
      });

      const context = createMockHonoContext({
        path: '/api/teams',
        headers: { 'X-Custom-Token': 'custom-token' },
        variables: { basePath: '/api' },
      });
      const next = createMockNext();

      await customMiddleware(context as unknown as Context, next as unknown as Next);

      expect(mockAdmin.getAuth().validateToken).toHaveBeenCalledWith('custom-token');
    });
  });
});
