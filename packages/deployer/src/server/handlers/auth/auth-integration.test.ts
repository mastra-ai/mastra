import { Mastra } from '@mastra/core/mastra';
import type { MastraAuthConfig } from '@mastra/core/server';
import { registerApiRoute } from '@mastra/core/server';
import { describe, it, expect } from 'vitest';
import { createHonoServer } from '../../index';

describe('auth middleware integration tests', () => {
  const authConfig: MastraAuthConfig = {
    protected: ['/api/*'],
    public: ['/api/health', '/webhooks/*'],
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
        // Allow all authenticated users to access all other routes
        path: /^\/(?!api\/admin)/,
        condition: (user: any) => !!user,
        allow: true,
      },
    ],
  };

  const createMastraWithRoutes = (routes: any[]) => {
    return new Mastra({
      server: {
        auth: authConfig,
        apiRoutes: routes,
      },
    });
  };

  describe('Public Routes', () => {
    it('should allow access to explicitly public routes without authentication', async () => {
      const routes = [
        {
          ...registerApiRoute('/webhooks/github', {
            method: 'POST',
            handler: c => c.json({ received: true }),
          }),
          requiresAuth: false,
        },
        {
          ...registerApiRoute('/public/status', {
            method: 'GET',
            handler: c => c.json({ status: 'public' }),
          }),
          requiresAuth: false,
        },
      ];

      const mastra = createMastraWithRoutes(routes);
      const app = await createHonoServer(mastra, { tools: {} });

      // Test webhook route
      const webhookReq = new Request('http://localhost/webhooks/github', {
        method: 'POST',
        body: JSON.stringify({ event: 'push' }),
        headers: { 'Content-Type': 'application/json' },
      });
      const webhookRes = await app.request(webhookReq);
      expect(webhookRes.status).toBe(200);
      const webhookData = await webhookRes.json();
      expect(webhookData.received).toBe(true);

      // Test public status route
      const statusReq = new Request('http://localhost/public/status');
      const statusRes = await app.request(statusReq);
      expect(statusRes.status).toBe(200);
      const statusData = await statusRes.json();
      expect(statusData.status).toBe('public');
    });

    it('should allow access to pattern-based public routes', async () => {
      // Test routes that match the public pattern in authConfig
      const mastra = createMastraWithRoutes([]);
      const app = await createHonoServer(mastra, { tools: {} });

      // Manually add routes that match public patterns
      app.get('/api/health', (c: any) => c.json({ status: 'healthy' }));
      app.post('/webhooks/github', (c: any) => c.json({ processed: true }));

      // Health endpoint should be public due to pattern
      const healthReq = new Request('http://localhost/api/health');
      const healthRes = await app.request(healthReq);
      expect(healthRes.status).toBe(200);

      // Webhook should be public due to pattern
      const githubReq = new Request('http://localhost/webhooks/github', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const githubRes = await app.request(githubReq);
      expect(githubRes.status).toBe(200);
    });
  });

  describe('Protected Routes', () => {
    it('should deny access to explicitly protected routes without authentication', async () => {
      const routes = [
        {
          ...registerApiRoute('/data/sensitive', {
            method: 'GET',
            handler: c => c.json({ data: 'sensitive information' }),
          }),
          requiresAuth: true,
        },
        {
          ...registerApiRoute('/user/profile', {
            method: 'GET',
            handler: c => c.json({ profile: 'user data' }),
          }),
          requiresAuth: true,
        },
      ];

      const mastra = createMastraWithRoutes(routes);
      const app = await createHonoServer(mastra, { tools: {} });

      // Test sensitive data endpoint
      const dataReq = new Request('http://localhost/data/sensitive');
      const dataRes = await app.request(dataReq);
      expect(dataRes.status).toBe(401);

      // Test user profile endpoint
      const profileReq = new Request('http://localhost/user/profile');
      const profileRes = await app.request(profileReq);
      expect(profileRes.status).toBe(401);
    });

    it('should allow access to protected routes with valid authentication', async () => {
      const routes = [
        {
          ...registerApiRoute('/data/sensitive', {
            method: 'GET',
            handler: c => c.json({ data: 'sensitive information' }),
          }),
          requiresAuth: true,
        },
        {
          ...registerApiRoute('/user/profile', {
            method: 'POST',
            handler: c => c.json({ updated: true }),
          }),
          requiresAuth: true,
        },
      ];

      const mastra = createMastraWithRoutes(routes);
      const app = await createHonoServer(mastra, { tools: {} });

      // Test with valid token
      const dataReq = new Request('http://localhost/data/sensitive', {
        headers: { Authorization: 'Bearer valid-token' },
      });
      const dataRes = await app.request(dataReq);
      expect(dataRes.status).toBe(200);
      const dataJson = await dataRes.json();
      expect(dataJson.data).toBe('sensitive information');

      // Test POST with valid token
      const profileReq = new Request('http://localhost/user/profile', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer valid-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'Updated Name' }),
      });
      const profileRes = await app.request(profileReq);
      expect(profileRes.status).toBe(200);
      const profileJson = await profileRes.json();
      expect(profileJson.updated).toBe(true);
    });

    it('should deny access with invalid authentication tokens', async () => {
      const routes = [
        {
          ...registerApiRoute('/data/sensitive', {
            method: 'GET',
            handler: c => c.json({ data: 'sensitive information' }),
          }),
          requiresAuth: true,
        },
      ];

      const mastra = createMastraWithRoutes(routes);
      const app = await createHonoServer(mastra, { tools: {} });

      // Test with invalid token
      const invalidReq = new Request('http://localhost/data/sensitive', {
        headers: { Authorization: 'Bearer invalid-token' },
      });
      const invalidRes = await app.request(invalidReq);
      expect(invalidRes.status).toBe(401);

      // Test with malformed header
      const malformedReq = new Request('http://localhost/data/sensitive', {
        headers: { Authorization: 'NotBearer token' },
      });
      const malformedRes = await app.request(malformedReq);
      expect(malformedRes.status).toBe(401);
    });
  });

  describe('Default Behavior', () => {
    it('should default to requiring authentication when requiresAuth is not specified', async () => {
      const routes = [
        {
          ...registerApiRoute('/default/behavior', {
            method: 'GET',
            handler: c => c.json({ message: 'default behavior' }),
          }),
          // No requiresAuth specified - should default to true
        },
        {
          ...registerApiRoute('/another/default', {
            method: 'POST',
            handler: c => c.json({ created: true }),
          }),
          // No requiresAuth specified - should default to true
        },
      ];

      const mastra = createMastraWithRoutes(routes);
      const app = await createHonoServer(mastra, { tools: {} });

      // Should require auth by default
      const defaultReq = new Request('http://localhost/default/behavior');
      const defaultRes = await app.request(defaultReq);
      expect(defaultRes.status).toBe(401);

      // Should work with auth
      const authReq = new Request('http://localhost/default/behavior', {
        headers: { Authorization: 'Bearer valid-token' },
      });
      const authRes = await app.request(authReq);
      expect(authRes.status).toBe(200);

      // Test POST default behavior
      const postReq = new Request('http://localhost/another/default', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const postRes = await app.request(postReq);
      expect(postRes.status).toBe(401);

      // POST with auth should work
      const postAuthReq = new Request('http://localhost/another/default', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer valid-token',
          'Content-Type': 'application/json',
        },
      });
      const postAuthRes = await app.request(postAuthReq);
      expect(postAuthRes.status).toBe(200);
    });
  });

  describe('Pattern-Based Protection', () => {
    it('should protect routes matching protected patterns', async () => {
      // Test that /api/* pattern protection works
      const mastra = createMastraWithRoutes([]);
      const app = await createHonoServer(mastra, { tools: {} });

      // Add routes manually that match protected patterns
      app.get('/api/users', (c: any) => c.json({ users: [] }));
      app.post('/api/posts', (c: any) => c.json({ created: true }));

      // Both should be protected due to /api/* pattern
      const usersReq = new Request('http://localhost/api/users');
      const usersRes = await app.request(usersReq);
      expect(usersRes.status).toBe(401);

      const postsReq = new Request('http://localhost/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const postsRes = await app.request(postsReq);
      expect(postsRes.status).toBe(401);

      // Should work with auth
      const usersAuthReq = new Request('http://localhost/api/users', {
        headers: { Authorization: 'Bearer valid-token' },
      });
      const usersAuthRes = await app.request(usersAuthReq);
      expect(usersAuthRes.status).toBe(200);
    });

    it('should override pattern protection with explicit route configuration', async () => {
      const routes = [
        {
          ...registerApiRoute('/custom/public-override', {
            method: 'GET',
            handler: c => c.json({ message: 'public override' }),
          }),
          requiresAuth: false,
        },
      ];

      const mastra = createMastraWithRoutes(routes);
      const app = await createHonoServer(mastra, { tools: {} });

      // Should be public despite any other configuration
      const req = new Request('http://localhost/custom/public-override');
      const res = await app.request(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.message).toBe('public override');
    });
  });

  describe('Authorization Rules', () => {
    it('should enforce role-based authorization rules', async () => {
      const mastra = createMastraWithRoutes([]);
      const app = await createHonoServer(mastra, { tools: {} });

      // Add admin route manually
      app.get('/api/admin/users', (c: any) => c.json({ adminData: true }));

      // Should deny regular user access to admin route
      const userReq = new Request('http://localhost/api/admin/users', {
        headers: { Authorization: 'Bearer valid-token' }, // regular user
      });
      const userRes = await app.request(userReq);
      expect(userRes.status).toBe(403);

      // Should allow admin access
      const adminReq = new Request('http://localhost/api/admin/users', {
        headers: { Authorization: 'Bearer admin-token' }, // admin user
      });
      const adminRes = await app.request(adminReq);
      expect(adminRes.status).toBe(200);
    });
  });

  describe('HTTP Method Handling', () => {
    it('should handle different auth requirements for same path with different methods', async () => {
      const routes = [
        {
          ...registerApiRoute('/multi/endpoint', {
            method: 'GET',
            handler: c => c.json({ method: 'GET', data: 'public' }),
          }),
          requiresAuth: false,
        },
        {
          ...registerApiRoute('/multi/endpoint', {
            method: 'POST',
            handler: c => c.json({ method: 'POST', data: 'protected' }),
          }),
          requiresAuth: true,
        },
        {
          ...registerApiRoute('/multi/endpoint', {
            method: 'PUT',
            handler: c => c.json({ method: 'PUT', data: 'default' }),
          }),
          // No requiresAuth - should default to true
        },
      ];

      const mastra = createMastraWithRoutes(routes);
      const app = await createHonoServer(mastra, { tools: {} });

      // GET should be public
      const getReq = new Request('http://localhost/multi/endpoint');
      const getRes = await app.request(getReq);
      expect(getRes.status).toBe(200);
      const getData = await getRes.json();
      expect(getData.method).toBe('GET');

      // POST should require auth
      const postReq = new Request('http://localhost/multi/endpoint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const postRes = await app.request(postReq);
      expect(postRes.status).toBe(401);

      // POST with auth should work
      const postAuthReq = new Request('http://localhost/multi/endpoint', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
      });
      const postAuthRes = await app.request(postAuthReq);
      expect(postAuthRes.status).toBe(200);

      // PUT should require auth (default behavior)
      const putReq = new Request('http://localhost/multi/endpoint', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
      });
      const putRes = await app.request(putReq);
      expect(putRes.status).toBe(401);

      // PUT with auth should work
      const putAuthReq = new Request('http://localhost/multi/endpoint', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
      });
      const putAuthRes = await app.request(putAuthReq);
      expect(putAuthRes.status).toBe(200);
    });
  });
});
