import * as http from 'node:http';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { HealthChecker } from './health-checker';
import type { LocalRoute } from './types';

function createRoute(overrides: Partial<LocalRoute> = {}): LocalRoute {
  return {
    routeId: 'route_test123',
    deploymentId: 'deploy_test123',
    projectId: 'project_test123',
    subdomain: 'test-subdomain',
    targetHost: '127.0.0.1',
    targetPort: 38080,
    publicUrl: 'http://127.0.0.1:38080',
    status: 'pending',
    tls: false,
    createdAt: new Date(),
    healthCheckFailures: 0,
    ...overrides,
  };
}

describe('HealthChecker', () => {
  let healthChecker: HealthChecker;
  let server: http.Server | null = null;

  beforeEach(() => {
    healthChecker = new HealthChecker({
      path: '/health',
      timeoutMs: 2000,
      failureThreshold: 3,
    });
  });

  afterEach(async () => {
    if (server) {
      await new Promise<void>(resolve => {
        server!.close(() => resolve());
      });
      server = null;
    }
  });

  /**
   * Create a test HTTP server
   */
  function createServer(
    port: number,
    handler: (req: http.IncomingMessage, res: http.ServerResponse) => void,
  ): Promise<http.Server> {
    return new Promise((resolve, reject) => {
      server = http.createServer(handler);
      server.once('error', reject);
      server.once('listening', () => resolve(server!));
      server.listen(port, '127.0.0.1');
    });
  }

  describe('check', () => {
    it('should return healthy for successful response', async () => {
      await createServer(38080, (req, res) => {
        res.writeHead(200);
        res.end('OK');
      });

      const route = createRoute();
      const result = await healthChecker.check(route);

      expect(result.healthy).toBe(true);
      expect(result.statusCode).toBe(200);
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
      expect(result.error).toBeUndefined();
    });

    it('should return unhealthy for non-OK status codes', async () => {
      await createServer(38081, (req, res) => {
        res.writeHead(500, 'Internal Server Error');
        res.end('Error');
      });

      const route = createRoute({ targetPort: 38081, publicUrl: 'http://127.0.0.1:38081' });
      const result = await healthChecker.check(route);

      expect(result.healthy).toBe(false);
      expect(result.statusCode).toBe(500);
      expect(result.error).toContain('Non-OK response');
      expect(result.error).toContain('500');
    });

    it('should return unhealthy for 404 status', async () => {
      await createServer(38082, (req, res) => {
        res.writeHead(404, 'Not Found');
        res.end('Not Found');
      });

      const route = createRoute({ targetPort: 38082, publicUrl: 'http://127.0.0.1:38082' });
      const result = await healthChecker.check(route);

      expect(result.healthy).toBe(false);
      expect(result.statusCode).toBe(404);
    });

    it('should use correct health check path', async () => {
      let requestedPath = '';
      await createServer(38083, (req, res) => {
        requestedPath = req.url || '';
        res.writeHead(200);
        res.end('OK');
      });

      const route = createRoute({ targetPort: 38083 });
      await healthChecker.check(route);

      expect(requestedPath).toBe('/health');
    });

    it('should use custom health check path', async () => {
      const customChecker = new HealthChecker({
        path: '/api/status',
        timeoutMs: 2000,
        failureThreshold: 3,
      });

      let requestedPath = '';
      await createServer(38084, (req, res) => {
        requestedPath = req.url || '';
        res.writeHead(200);
        res.end('OK');
      });

      const route = createRoute({ targetPort: 38084 });
      await customChecker.check(route);

      expect(requestedPath).toBe('/api/status');
    });

    it('should return unhealthy when server is unreachable', async () => {
      const route = createRoute({ targetPort: 38999 }); // No server on this port

      const result = await healthChecker.check(route);

      expect(result.healthy).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('should handle timeout', async () => {
      const shortTimeoutChecker = new HealthChecker({
        path: '/health',
        timeoutMs: 100, // Very short timeout
        failureThreshold: 3,
      });

      await createServer(38085, (req, res) => {
        // Delay response longer than timeout
        setTimeout(() => {
          res.writeHead(200);
          res.end('OK');
        }, 500);
      });

      const route = createRoute({ targetPort: 38085 });
      const result = await shortTimeoutChecker.check(route);

      expect(result.healthy).toBe(false);
      expect(result.error).toContain('timed out');
      expect(result.error).toContain('100ms');
    });

    it('should return healthy for 2xx status codes', async () => {
      await createServer(38086, (req, res) => {
        res.writeHead(201, 'Created');
        res.end('Created');
      });

      const route = createRoute({ targetPort: 38086 });
      const result = await healthChecker.check(route);

      expect(result.healthy).toBe(true);
      expect(result.statusCode).toBe(201);
    });

    it('should return unhealthy for 4xx client error status codes', async () => {
      await createServer(38087, (req, res) => {
        res.writeHead(400, 'Bad Request');
        res.end('Bad Request');
      });

      const route = createRoute({ targetPort: 38087 });
      const result = await healthChecker.check(route);

      expect(result.healthy).toBe(false);
      expect(result.statusCode).toBe(400);
    });

    it('should measure latency', async () => {
      const delay = 50;
      await createServer(38088, (req, res) => {
        setTimeout(() => {
          res.writeHead(200);
          res.end('OK');
        }, delay);
      });

      const route = createRoute({ targetPort: 38088 });
      const result = await healthChecker.check(route);

      expect(result.latencyMs).toBeGreaterThanOrEqual(delay);
    });

    it('should include latency even for errors', async () => {
      const route = createRoute({ targetPort: 38998 }); // No server

      const result = await healthChecker.check(route);

      expect(result.latencyMs).toBeDefined();
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('shouldMarkUnhealthy', () => {
    it('should return false when failure count is below threshold', () => {
      expect(healthChecker.shouldMarkUnhealthy(0)).toBe(false);
      expect(healthChecker.shouldMarkUnhealthy(1)).toBe(false);
      expect(healthChecker.shouldMarkUnhealthy(2)).toBe(false);
    });

    it('should return true when failure count equals threshold', () => {
      expect(healthChecker.shouldMarkUnhealthy(3)).toBe(true);
    });

    it('should return true when failure count exceeds threshold', () => {
      expect(healthChecker.shouldMarkUnhealthy(4)).toBe(true);
      expect(healthChecker.shouldMarkUnhealthy(10)).toBe(true);
    });

    it('should use configured threshold', () => {
      const customChecker = new HealthChecker({
        path: '/health',
        timeoutMs: 5000,
        failureThreshold: 5,
      });

      expect(customChecker.shouldMarkUnhealthy(4)).toBe(false);
      expect(customChecker.shouldMarkUnhealthy(5)).toBe(true);
    });

    it('should work with threshold of 1', () => {
      const strictChecker = new HealthChecker({
        path: '/health',
        timeoutMs: 5000,
        failureThreshold: 1,
      });

      expect(strictChecker.shouldMarkUnhealthy(0)).toBe(false);
      expect(strictChecker.shouldMarkUnhealthy(1)).toBe(true);
    });
  });
});
