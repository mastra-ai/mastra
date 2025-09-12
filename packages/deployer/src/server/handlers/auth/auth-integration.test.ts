import { Mastra } from '@mastra/core';
import { RuntimeContext } from '@mastra/core/runtime-context';
import type { MastraAuthConfig } from '@mastra/core/server';
import { Hono } from 'hono';
import { describe, it, expect, beforeEach } from 'vitest';
import { authenticationMiddleware, authorizationMiddleware } from './index';

describe('auth middleware integration tests', () => {
  let app: Hono;
  let mastra: Mastra;

  const authConfig: MastraAuthConfig = {
    protected: ['/api/*'],
    public: ['/api/health'],
    authenticateToken: async (token: string) => {
      if (token === 'valid-token') {
        return { id: '123', name: 'Test User', role: 'user' };
      }
      if (token === 'admin-token') {
        return { id: '456', name: 'Admin User', role: 'admin' };
      }
      return null;
    },
    rules: [
      {
        path: '/api/admin/*',
        condition: (user: any) => user?.role === 'admin',
        allow: true,
      },
      {
        // Allow all authenticated users to access non-admin API routes
        path: '/api/*',
        condition: (user: any) => !!user,
        allow: true,
      },
    ],
  };

  beforeEach(() => {
    app = new Hono();
    mastra = new Mastra({
      server: {
        experimental_auth: authConfig,
      },
    });

    // Add context middleware
    app.use('*', async (c, next) => {
      const runtimeContext = new RuntimeContext();
      const customRouteAuthConfig = new Map<string, boolean>();

      // Set up custom route auth configs
      customRouteAuthConfig.set('GET:/api/custom/public', false);
      customRouteAuthConfig.set('GET:/api/custom/protected', true);
      customRouteAuthConfig.set('POST:/webhooks/github', false);
      customRouteAuthConfig.set('ALL:/api/all-public', false);

      (c as any).set('mastra', mastra);
      (c as any).set('runtimeContext', runtimeContext);
      (c as any).set('customRouteAuthConfig', customRouteAuthConfig);

      await next();
    });

    // Add auth middleware
    app.use('*', authenticationMiddleware as any);
    app.use('*', authorizationMiddleware as any);

    // Add test routes
    app.get('/api/custom/public', c => c.json({ message: 'public route' }));
    app.get('/api/custom/protected', c => c.json({ message: 'protected route' }));
    app.post('/webhooks/github', c => c.json({ message: 'webhook route' }));
    app.get('/api/all-public', c => c.json({ message: 'all methods public' }));
    app.post('/api/all-public', c => c.json({ message: 'all methods public' }));
    app.get('/api/health', c => c.json({ status: 'ok' }));
    app.get('/api/users', c => c.json({ users: [] }));
  });

  describe('custom route authentication', () => {
    it('should allow access to custom public routes without authentication', async () => {
      const req = new Request('http://localhost/api/custom/public');
      const res = await app.request(req);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.message).toBe('public route');
    });

    it('should deny access to custom protected routes without authentication', async () => {
      const req = new Request('http://localhost/api/custom/protected');
      const res = await app.request(req);

      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe('Authentication required');
    });

    it('should allow access to custom protected routes with valid authentication', async () => {
      const req = new Request('http://localhost/api/custom/protected', {
        headers: {
          Authorization: 'Bearer valid-token',
        },
      });
      const res = await app.request(req);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.message).toBe('protected route');
    });

    it('should allow access to webhook routes without authentication', async () => {
      const req = new Request('http://localhost/webhooks/github', {
        method: 'POST',
        body: JSON.stringify({ event: 'push' }),
        headers: {
          'Content-Type': 'application/json',
        },
      });
      const res = await app.request(req);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.message).toBe('webhook route');
    });

    it('should handle ALL method configuration correctly', async () => {
      // GET request without auth
      const getReq = new Request('http://localhost/api/all-public');
      const getRes = await app.request(getReq);
      expect(getRes.status).toBe(200);

      // POST request without auth
      const postReq = new Request('http://localhost/api/all-public', {
        method: 'POST',
      });
      const postRes = await app.request(postReq);
      expect(postRes.status).toBe(200);
    });
  });

  describe('default auth configuration', () => {
    it('should allow access to public routes without authentication', async () => {
      const req = new Request('http://localhost/api/health');
      const res = await app.request(req);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe('ok');
    });

    it('should deny access to protected routes without authentication', async () => {
      const req = new Request('http://localhost/api/users');
      const res = await app.request(req);

      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe('Authentication required');
    });

    it('should allow access to protected routes with valid authentication', async () => {
      const req = new Request('http://localhost/api/users', {
        headers: {
          Authorization: 'Bearer valid-token',
        },
      });
      const res = await app.request(req);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.users).toEqual([]);
    });

    it('should deny access with invalid token', async () => {
      const req = new Request('http://localhost/api/users', {
        headers: {
          Authorization: 'Bearer invalid-token',
        },
      });
      const res = await app.request(req);

      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe('Invalid or expired token');
    });
  });

  describe('mixed configuration', () => {
    it('should prioritize custom route config over default protected patterns', async () => {
      // /api/custom/public matches /api/* (protected by default)
      // but custom route config says it's public
      const req = new Request('http://localhost/api/custom/public');
      const res = await app.request(req);

      expect(res.status).toBe(200);
    });

    it('should respect both custom and default configurations', async () => {
      const publicReq = new Request('http://localhost/api/custom/public');
      const publicRes = await app.request(publicReq);
      expect(publicRes.status).toBe(200);

      const protectedReq = new Request('http://localhost/api/custom/protected');
      const protectedRes = await app.request(protectedReq);
      expect(protectedRes.status).toBe(401);

      const healthReq = new Request('http://localhost/api/health');
      const healthRes = await app.request(healthReq);
      expect(healthRes.status).toBe(200);

      const usersReq = new Request('http://localhost/api/users');
      const usersRes = await app.request(usersReq);
      expect(usersRes.status).toBe(401);
    });
  });
});
