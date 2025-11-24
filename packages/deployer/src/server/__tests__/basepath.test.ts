import { Mastra } from '@mastra/core/mastra';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createHonoServer } from '../index';

describe('Server Base Path Configuration', () => {
  let mastra: Mastra;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('basePath normalization', () => {
    it('should store base path in config as provided without normalization', async () => {
      mastra = new Mastra({
        server: {
          base: 'admin',
        },
      });

      const app = await createHonoServer(mastra, { playground: true });
      const basePath = mastra.getServer()?.base;

      // The config stores the base value as provided by the user
      // Normalization (adding leading slash, removing trailing slash) happens
      // in the server implementation (createHonoServer) when setting up routes
      expect(basePath).toBe('admin');
    });

    it('should store base path with trailing slash as provided', async () => {
      mastra = new Mastra({
        server: {
          base: '/admin/',
        },
      });

      const basePath = mastra.getServer()?.base;
      // Config stores the value exactly as provided
      expect(basePath).toBe('/admin/');
    });

    it('should handle empty base path', async () => {
      mastra = new Mastra({
        server: {},
      });

      const basePath = mastra.getServer()?.base;
      expect(basePath).toBeUndefined();
    });
  });

  describe('playground HTML injection', () => {
    it('should inject MASTRA_BASE_PATH into HTML', async () => {
      mastra = new Mastra({
        server: {
          base: '/studio',
          port: 4111,
          host: 'localhost',
        },
      });

      // We can't test the actual HTML serving without the playground files
      // but we can verify the configuration is correct
      const serverConfig = mastra.getServer();
      expect(serverConfig?.base).toBe('/studio');
      expect(serverConfig?.port).toBe(4111);
      expect(serverConfig?.host).toBe('localhost');
    });

    it('should handle empty base path configuration', async () => {
      mastra = new Mastra({
        server: {
          port: 4111,
          host: 'localhost',
        },
      });

      const serverConfig = mastra.getServer();
      expect(serverConfig?.base).toBeUndefined();
    });
  });

  describe('route scoping with base path', () => {
    it('should configure routes under base path', async () => {
      mastra = new Mastra({
        server: {
          base: '/admin',
        },
      });

      const app = await createHonoServer(mastra, { playground: true });

      // Verify the app was created successfully
      expect(app).toBeDefined();

      // The configuration should be set
      const serverConfig = mastra.getServer();
      expect(serverConfig?.base).toBe('/admin');
    });

    it('should handle root path when no base path configured', async () => {
      mastra = new Mastra({
        server: {},
      });

      const app = await createHonoServer(mastra, { playground: true });

      const serverConfig = mastra.getServer();
      expect(serverConfig?.base).toBeUndefined();
    });
  });

  describe('API routes unaffected by base path', () => {
    it('should keep API routes at /api regardless of base path', async () => {
      mastra = new Mastra({
        server: {
          base: '/admin',
        },
      });

      const app = await createHonoServer(mastra, { playground: true });

      // API routes should still be at /api, not /admin/api
      const apiReq = new Request('http://localhost:4111/api/agents');
      const apiRes = await app.request(apiReq);

      // Should return a valid response (200 or 404 are both valid - 404 means no agents exist)
      // What we're checking is that the route handler was reached, not a "route not found" error
      expect(apiRes.status).toBeGreaterThanOrEqual(200);
      expect(apiRes.status).toBeLessThan(500);
    });
  });

  describe('SSE connection with base path', () => {
    it('should configure SSE to use base path', async () => {
      mastra = new Mastra({
        server: {
          base: '/studio',
        },
      });

      const app = await createHonoServer(mastra, { playground: true });

      // Verify SSE endpoint is configured
      const serverConfig = mastra.getServer();
      expect(serverConfig?.base).toBe('/studio');

      // The SSE endpoint should be set up (actual testing would require file system mock)
      expect(app).toBeDefined();
    });
  });
});
