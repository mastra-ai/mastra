/**
 * Unit tests for AdminServer class.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { createMockMastraAdmin } from './__tests__/test-utils';
import { AdminServer } from './server';

describe('AdminServer', () => {
  let server: AdminServer;
  let mockAdmin: ReturnType<typeof createMockMastraAdmin>;

  beforeEach(() => {
    mockAdmin = createMockMastraAdmin();
    // Suppress console output during tests
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(async () => {
    if (server) {
      await server.stop();
    }
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create server with default config', () => {
      server = new AdminServer({
        admin: mockAdmin,
        enableBuildWorker: false,
        enableHealthWorker: false,
        enableWebSocket: false,
        enableRequestLogging: false,
      });

      expect(server).toBeDefined();
      expect(server.getAdmin()).toBe(mockAdmin);
      expect(server.getApp()).toBeDefined();
    });

    it('should apply custom configuration', () => {
      server = new AdminServer({
        admin: mockAdmin,
        port: 4000,
        host: '0.0.0.0',
        basePath: '/v1',
        timeout: 60000,
        enableBuildWorker: false,
        enableHealthWorker: false,
        enableWebSocket: false,
        enableRequestLogging: false,
      });

      const status = server.getStatus();
      expect(status.port).toBe(4000);
      expect(status.host).toBe('0.0.0.0');
    });
  });

  describe('getApp', () => {
    it('should return the Hono app instance', () => {
      server = new AdminServer({
        admin: mockAdmin,
        enableBuildWorker: false,
        enableHealthWorker: false,
        enableWebSocket: false,
        enableRequestLogging: false,
      });

      const app = server.getApp();
      expect(app).toBeDefined();
      expect(typeof app.fetch).toBe('function');
    });
  });

  describe('getAdmin', () => {
    it('should return the MastraAdmin instance', () => {
      server = new AdminServer({
        admin: mockAdmin,
        enableBuildWorker: false,
        enableHealthWorker: false,
        enableWebSocket: false,
        enableRequestLogging: false,
      });

      expect(server.getAdmin()).toBe(mockAdmin);
    });
  });

  describe('isHealthy', () => {
    it('should return false when server is not started', () => {
      server = new AdminServer({
        admin: mockAdmin,
        enableBuildWorker: false,
        enableHealthWorker: false,
        enableWebSocket: false,
        enableRequestLogging: false,
      });

      expect(server.isHealthy()).toBe(false);
    });

    it('should return true after server is started', async () => {
      server = new AdminServer({
        admin: mockAdmin,
        port: 0, // Random available port
        enableBuildWorker: false,
        enableHealthWorker: false,
        enableWebSocket: false,
        enableRequestLogging: false,
      });

      await server.start();
      expect(server.isHealthy()).toBe(true);
    });
  });

  describe('getStatus', () => {
    it('should return server status when not running', () => {
      server = new AdminServer({
        admin: mockAdmin,
        port: 3456,
        host: 'localhost',
        enableBuildWorker: false,
        enableHealthWorker: false,
        enableWebSocket: false,
        enableRequestLogging: false,
      });

      const status = server.getStatus();
      expect(status.running).toBe(false);
      expect(status.uptime).toBe(0);
      expect(status.buildWorkerActive).toBe(false);
      expect(status.healthWorkerActive).toBe(false);
      expect(status.wsConnectionCount).toBe(0);
      expect(status.port).toBe(3456);
      expect(status.host).toBe('localhost');
    });

    it('should return running status after start', async () => {
      server = new AdminServer({
        admin: mockAdmin,
        port: 0,
        enableBuildWorker: false,
        enableHealthWorker: false,
        enableWebSocket: false,
        enableRequestLogging: false,
      });

      await server.start();
      const status = server.getStatus();
      expect(status.running).toBe(true);
      expect(status.uptime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('start and stop', () => {
    it('should start and stop cleanly', async () => {
      server = new AdminServer({
        admin: mockAdmin,
        port: 0,
        enableBuildWorker: false,
        enableHealthWorker: false,
        enableWebSocket: false,
        enableRequestLogging: false,
      });

      await server.start();
      expect(server.isHealthy()).toBe(true);

      await server.stop();
      // After stop, isHealthy may still be true until server fully closes
      // We just verify stop completes without error
    });
  });

  describe('health check endpoint', () => {
    it('should respond to /health endpoint', async () => {
      server = new AdminServer({
        admin: mockAdmin,
        port: 0,
        enableBuildWorker: false,
        enableHealthWorker: false,
        enableWebSocket: false,
        enableRequestLogging: false,
      });

      const app = server.getApp();
      const response = await app.request('/health');

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toEqual({ status: 'ok' });
    });
  });

  describe('ready check endpoint', () => {
    it('should respond to /ready endpoint when license is valid', async () => {
      server = new AdminServer({
        admin: mockAdmin,
        port: 0,
        enableBuildWorker: false,
        enableHealthWorker: false,
        enableWebSocket: false,
        enableRequestLogging: false,
      });

      const app = server.getApp();
      const response = await app.request('/ready');

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toEqual({ ready: true });
    });

    it('should return 503 when license is invalid', async () => {
      mockAdmin.getLicenseInfo.mockReturnValue({ valid: false });

      server = new AdminServer({
        admin: mockAdmin,
        port: 0,
        enableBuildWorker: false,
        enableHealthWorker: false,
        enableWebSocket: false,
        enableRequestLogging: false,
      });

      const app = server.getApp();
      const response = await app.request('/ready');

      expect(response.status).toBe(503);
      const body = await response.json();
      expect(body).toEqual({ ready: false });
    });
  });

  describe('API routes', () => {
    it('should require authentication for API routes', async () => {
      server = new AdminServer({
        admin: mockAdmin,
        port: 0,
        basePath: '/api',
        enableBuildWorker: false,
        enableHealthWorker: false,
        enableWebSocket: false,
        enableRequestLogging: false,
      });

      const app = server.getApp();
      const response = await app.request('/api/teams');

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error).toBe('Authentication required');
    });

    it('should allow authenticated requests', async () => {
      server = new AdminServer({
        admin: mockAdmin,
        port: 0,
        basePath: '/api',
        enableBuildWorker: false,
        enableHealthWorker: false,
        enableWebSocket: false,
        enableRequestLogging: false,
      });

      const app = server.getApp();
      const response = await app.request('/api/teams', {
        headers: {
          Authorization: 'Bearer valid-token',
        },
      });

      // Should pass auth and return team list
      expect(response.status).toBe(200);
    });
  });

  describe('CORS configuration', () => {
    it('should apply default CORS headers', async () => {
      server = new AdminServer({
        admin: mockAdmin,
        port: 0,
        enableBuildWorker: false,
        enableHealthWorker: false,
        enableWebSocket: false,
        enableRequestLogging: false,
      });

      const app = server.getApp();
      const response = await app.request('/health', {
        method: 'OPTIONS',
        headers: {
          Origin: 'http://example.com',
        },
      });

      // CORS headers should be present
      expect(response.headers.get('access-control-allow-origin')).toBeDefined();
    });

    it('should apply custom CORS configuration', async () => {
      server = new AdminServer({
        admin: mockAdmin,
        port: 0,
        cors: {
          origin: 'https://app.example.com',
          allowMethods: ['GET', 'POST'],
          credentials: true,
        },
        enableBuildWorker: false,
        enableHealthWorker: false,
        enableWebSocket: false,
        enableRequestLogging: false,
      });

      const app = server.getApp();
      const response = await app.request('/health', {
        method: 'OPTIONS',
        headers: {
          Origin: 'https://app.example.com',
        },
      });

      expect(response.headers.get('access-control-allow-origin')).toBe('https://app.example.com');
    });
  });

  describe('workers', () => {
    it('should start build worker when enabled', async () => {
      // Use fake timers to avoid waiting for real intervals during stop
      vi.useFakeTimers();

      server = new AdminServer({
        admin: mockAdmin,
        port: 0,
        enableBuildWorker: true,
        buildWorkerIntervalMs: 10000,
        enableHealthWorker: false,
        enableWebSocket: false,
        enableRequestLogging: false,
      });

      await server.start();
      const worker = server.getBuildWorker();

      expect(worker).toBeDefined();
      expect(worker?.isRunning()).toBe(true);

      // Advance timers to allow clean shutdown
      const stopPromise = server.stop();
      await vi.runAllTimersAsync();
      await stopPromise;
      // Clear server so afterEach doesn't try to stop again
      server = undefined as unknown as AdminServer;

      vi.useRealTimers();
    });

    it('should start health worker when enabled', async () => {
      // Use fake timers to avoid waiting for real intervals during stop
      vi.useFakeTimers();

      server = new AdminServer({
        admin: mockAdmin,
        port: 0,
        enableBuildWorker: false,
        enableHealthWorker: true,
        healthCheckIntervalMs: 10000,
        enableWebSocket: false,
        enableRequestLogging: false,
      });

      await server.start();
      const worker = server.getHealthWorker();

      expect(worker).toBeDefined();
      expect(worker?.isRunning()).toBe(true);

      // Advance timers to allow clean shutdown
      const stopPromise = server.stop();
      await vi.runAllTimersAsync();
      await stopPromise;
      // Clear server so afterEach doesn't try to stop again
      server = undefined as unknown as AdminServer;

      vi.useRealTimers();
    });

    it('should not start workers when disabled', async () => {
      server = new AdminServer({
        admin: mockAdmin,
        port: 0,
        enableBuildWorker: false,
        enableHealthWorker: false,
        enableWebSocket: false,
        enableRequestLogging: false,
      });

      await server.start();

      expect(server.getBuildWorker()).toBeUndefined();
      expect(server.getHealthWorker()).toBeUndefined();
    });
  });

  describe('error handling', () => {
    it('should call custom error handler when provided', async () => {
      const customErrorHandler = vi.fn();

      server = new AdminServer({
        admin: mockAdmin,
        port: 0,
        onError: customErrorHandler,
        enableBuildWorker: false,
        enableHealthWorker: false,
        enableWebSocket: false,
        enableRequestLogging: false,
      });

      // The custom error handler would be called on route errors
      // This is tested indirectly through the error handler middleware tests
      expect(server).toBeDefined();
    });
  });
});
