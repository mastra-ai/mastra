import * as http from 'node:http';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { LocalEdgeRouter } from './router';

describe('LocalEdgeRouter', () => {
  let router: LocalEdgeRouter;
  let servers: http.Server[] = [];

  beforeEach(() => {
    router = new LocalEdgeRouter({
      portRange: { start: 37100, end: 37199 },
      logRoutes: false, // Disable logging in tests
      healthCheck: {
        path: '/health',
        timeoutMs: 1000,
        intervalMs: 100,
        failureThreshold: 3,
      },
    });
  });

  afterEach(async () => {
    await router.close();
    // Clean up any test servers
    await Promise.all(
      servers.map(
        server =>
          new Promise<void>(resolve => {
            server.close(() => resolve());
          }),
      ),
    );
    servers = [];
  });

  /**
   * Create a test HTTP server with a health endpoint
   */
  async function createHealthyServer(port: number): Promise<http.Server> {
    return new Promise((resolve, reject) => {
      const server = http.createServer((req, res) => {
        if (req.url === '/health') {
          res.writeHead(200);
          res.end('OK');
        } else {
          res.writeHead(404);
          res.end();
        }
      });
      server.once('error', reject);
      server.once('listening', () => {
        servers.push(server);
        resolve(server);
      });
      server.listen(port, '127.0.0.1');
    });
  }

  describe('constructor', () => {
    it('should create router with default config', () => {
      const defaultRouter = new LocalEdgeRouter();

      expect(defaultRouter.type).toBe('local');
    });

    it('should use custom configuration', () => {
      const customRouter = new LocalEdgeRouter({
        strategy: 'reverse-proxy',
        baseDomain: 'test.local',
        proxyPort: 8080,
      });

      expect(customRouter.type).toBe('local');
    });
  });

  describe('registerRoute', () => {
    it('should register a new route', async () => {
      await createHealthyServer(37001);

      const route = await router.registerRoute({
        deploymentId: 'deploy-123',
        projectId: 'project-456',
        subdomain: 'my-agent',
        targetHost: '127.0.0.1',
        targetPort: 37001,
      });

      expect(route.routeId).toMatch(/^route_/);
      expect(route.deploymentId).toBe('deploy-123');
      expect(route.publicUrl).toBe('http://127.0.0.1:37001');
      expect(route.createdAt).toBeInstanceOf(Date);
    });

    it('should set status to active when server is healthy', async () => {
      await createHealthyServer(37002);

      const route = await router.registerRoute({
        deploymentId: 'deploy-healthy',
        projectId: 'project-123',
        subdomain: 'healthy-agent',
        targetHost: '127.0.0.1',
        targetPort: 37002,
      });

      expect(route.status).toBe('active');
    });

    it('should set status to pending when server is unhealthy', async () => {
      // No server running - health check will fail
      const route = await router.registerRoute({
        deploymentId: 'deploy-unhealthy',
        projectId: 'project-123',
        subdomain: 'unhealthy-agent',
        targetHost: '127.0.0.1',
        targetPort: 37999, // No server on this port
      });

      expect(route.status).toBe('pending');
    });

    it('should throw when route already exists for deployment', async () => {
      await router.registerRoute({
        deploymentId: 'deploy-duplicate',
        projectId: 'project-123',
        subdomain: 'agent-1',
        targetHost: '127.0.0.1',
        targetPort: 37003,
      });

      await expect(
        router.registerRoute({
          deploymentId: 'deploy-duplicate',
          projectId: 'project-123',
          subdomain: 'agent-2',
          targetHost: '127.0.0.1',
          targetPort: 37004,
        }),
      ).rejects.toThrow('Route already exists for deployment deploy-duplicate');
    });

    it('should build correct public URL with TLS', async () => {
      const route = await router.registerRoute({
        deploymentId: 'deploy-tls',
        projectId: 'project-123',
        subdomain: 'secure-agent',
        targetHost: '127.0.0.1',
        targetPort: 37005,
        tls: true,
      });

      expect(route.publicUrl).toBe('https://127.0.0.1:37005');
    });

    it('should record lastHealthCheck time', async () => {
      const before = new Date();

      const route = await router.registerRoute({
        deploymentId: 'deploy-time',
        projectId: 'project-123',
        subdomain: 'timed-agent',
        targetHost: '127.0.0.1',
        targetPort: 37006,
      });

      expect(route.lastHealthCheck).toBeDefined();
      expect(route.lastHealthCheck!.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });
  });

  describe('updateRoute', () => {
    it('should update route target host', async () => {
      const original = await router.registerRoute({
        deploymentId: 'deploy-update-1',
        projectId: 'project-123',
        subdomain: 'update-agent',
        targetHost: '127.0.0.1',
        targetPort: 37010,
      });

      const updated = await router.updateRoute(original.routeId, {
        targetHost: '192.168.1.1',
      });

      expect(updated.publicUrl).toBe('http://192.168.1.1:37010');
    });

    it('should update route target port', async () => {
      const original = await router.registerRoute({
        deploymentId: 'deploy-update-2',
        projectId: 'project-123',
        subdomain: 'update-agent',
        targetHost: '127.0.0.1',
        targetPort: 37011,
      });

      const updated = await router.updateRoute(original.routeId, {
        targetPort: 37012,
      });

      expect(updated.publicUrl).toBe('http://127.0.0.1:37012');
    });

    it('should update subdomain', async () => {
      const original = await router.registerRoute({
        deploymentId: 'deploy-update-3',
        projectId: 'project-123',
        subdomain: 'original-name',
        targetHost: '127.0.0.1',
        targetPort: 37013,
      });

      const updated = await router.updateRoute(original.routeId, {
        subdomain: 'new-name',
      });

      // For port-mapping strategy, subdomain doesn't affect publicUrl
      expect(updated.publicUrl).toBe('http://127.0.0.1:37013');
    });

    it('should throw for non-existent route', async () => {
      await expect(router.updateRoute('non-existent-route', { targetPort: 3000 })).rejects.toThrow(
        'Route not found: non-existent-route',
      );
    });

    it('should update TLS setting', async () => {
      const original = await router.registerRoute({
        deploymentId: 'deploy-update-4',
        projectId: 'project-123',
        subdomain: 'tls-agent',
        targetHost: '127.0.0.1',
        targetPort: 37014,
        tls: false,
      });

      expect(original.publicUrl).toBe('http://127.0.0.1:37014');

      const updated = await router.updateRoute(original.routeId, {
        tls: true,
      });

      expect(updated.publicUrl).toBe('https://127.0.0.1:37014');
    });
  });

  describe('removeRoute', () => {
    it('should remove an existing route', async () => {
      const route = await router.registerRoute({
        deploymentId: 'deploy-remove',
        projectId: 'project-123',
        subdomain: 'remove-agent',
        targetHost: '127.0.0.1',
        targetPort: 37020,
      });

      await router.removeRoute(route.routeId);

      const retrieved = await router.getRoute('deploy-remove');
      expect(retrieved).toBeNull();
    });

    it('should be idempotent for non-existent route', async () => {
      // Should not throw
      await expect(router.removeRoute('non-existent-route')).resolves.not.toThrow();
    });

    it('should remove from all indexes', async () => {
      const route = await router.registerRoute({
        deploymentId: 'deploy-remove-full',
        projectId: 'project-remove',
        subdomain: 'full-remove-agent',
        targetHost: '127.0.0.1',
        targetPort: 37021,
      });

      await router.removeRoute(route.routeId);

      expect(await router.getRoute('deploy-remove-full')).toBeNull();
      expect(await router.listRoutes('project-remove')).toEqual([]);
    });
  });

  describe('getRoute', () => {
    it('should get route by deployment ID', async () => {
      await router.registerRoute({
        deploymentId: 'deploy-get',
        projectId: 'project-123',
        subdomain: 'get-agent',
        targetHost: '127.0.0.1',
        targetPort: 37030,
      });

      const route = await router.getRoute('deploy-get');

      expect(route).not.toBeNull();
      expect(route!.deploymentId).toBe('deploy-get');
    });

    it('should return null for non-existent deployment', async () => {
      const route = await router.getRoute('non-existent-deployment');

      expect(route).toBeNull();
    });
  });

  describe('listRoutes', () => {
    it('should list all routes for a project', async () => {
      const projectId = 'project-list';

      await router.registerRoute({
        deploymentId: 'deploy-list-1',
        projectId,
        subdomain: 'agent-1',
        targetHost: '127.0.0.1',
        targetPort: 37040,
      });

      await router.registerRoute({
        deploymentId: 'deploy-list-2',
        projectId,
        subdomain: 'agent-2',
        targetHost: '127.0.0.1',
        targetPort: 37041,
      });

      const routes = await router.listRoutes(projectId);

      expect(routes).toHaveLength(2);
      expect(routes.map(r => r.deploymentId)).toContain('deploy-list-1');
      expect(routes.map(r => r.deploymentId)).toContain('deploy-list-2');
    });

    it('should return empty array for project with no routes', async () => {
      const routes = await router.listRoutes('non-existent-project');

      expect(routes).toEqual([]);
    });

    it('should not include routes from other projects', async () => {
      await router.registerRoute({
        deploymentId: 'deploy-project-a',
        projectId: 'project-a',
        subdomain: 'agent-a',
        targetHost: '127.0.0.1',
        targetPort: 37042,
      });

      await router.registerRoute({
        deploymentId: 'deploy-project-b',
        projectId: 'project-b',
        subdomain: 'agent-b',
        targetHost: '127.0.0.1',
        targetPort: 37043,
      });

      const routesA = await router.listRoutes('project-a');
      const routesB = await router.listRoutes('project-b');

      expect(routesA).toHaveLength(1);
      expect(routesA[0].deploymentId).toBe('deploy-project-a');
      expect(routesB).toHaveLength(1);
      expect(routesB[0].deploymentId).toBe('deploy-project-b');
    });
  });

  describe('checkRouteHealth', () => {
    it('should return healthy for responsive server', async () => {
      await createHealthyServer(37050);

      const route = await router.registerRoute({
        deploymentId: 'deploy-health-good',
        projectId: 'project-123',
        subdomain: 'healthy-agent',
        targetHost: '127.0.0.1',
        targetPort: 37050,
      });

      const health = await router.checkRouteHealth(route.routeId);

      expect(health.healthy).toBe(true);
      expect(health.statusCode).toBe(200);
      expect(health.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('should return unhealthy for unresponsive server', async () => {
      const route = await router.registerRoute({
        deploymentId: 'deploy-health-bad',
        projectId: 'project-123',
        subdomain: 'unhealthy-agent',
        targetHost: '127.0.0.1',
        targetPort: 37998, // No server
      });

      const health = await router.checkRouteHealth(route.routeId);

      expect(health.healthy).toBe(false);
      expect(health.error).toBeDefined();
    });

    it('should return unhealthy for non-existent route', async () => {
      const health = await router.checkRouteHealth('non-existent-route');

      expect(health.healthy).toBe(false);
      expect(health.error).toContain('Route not found');
    });

    it('should update route status to active on successful health check', async () => {
      await createHealthyServer(37051);

      const route = await router.registerRoute({
        deploymentId: 'deploy-status-active',
        projectId: 'project-123',
        subdomain: 'status-agent',
        targetHost: '127.0.0.1',
        targetPort: 37051,
      });

      await router.checkRouteHealth(route.routeId);

      const updated = await router.getRoute('deploy-status-active');
      expect(updated!.status).toBe('active');
    });

    it('should mark route unhealthy after failure threshold', async () => {
      // Create router with low threshold for testing
      const strictRouter = new LocalEdgeRouter({
        portRange: { start: 37200, end: 37299 },
        logRoutes: false,
        healthCheck: {
          path: '/health',
          timeoutMs: 500,
          intervalMs: 100,
          failureThreshold: 2,
        },
      });

      const route = await strictRouter.registerRoute({
        deploymentId: 'deploy-threshold',
        projectId: 'project-123',
        subdomain: 'threshold-agent',
        targetHost: '127.0.0.1',
        targetPort: 37997, // No server
      });

      // First failure (status stays pending)
      await strictRouter.checkRouteHealth(route.routeId);
      let current = await strictRouter.getRoute('deploy-threshold');
      expect(current!.status).toBe('pending');

      // Second failure - should mark unhealthy (threshold is 2)
      await strictRouter.checkRouteHealth(route.routeId);
      current = await strictRouter.getRoute('deploy-threshold');
      expect(current!.status).toBe('unhealthy');

      await strictRouter.close();
    });

    it('should reset failure count on successful health check', async () => {
      const server = await createHealthyServer(37052);

      const route = await router.registerRoute({
        deploymentId: 'deploy-reset',
        projectId: 'project-123',
        subdomain: 'reset-agent',
        targetHost: '127.0.0.1',
        targetPort: 37052,
      });

      // Simulate a failure by shutting down server
      await new Promise<void>(resolve => {
        server.close(() => resolve());
      });
      servers = servers.filter(s => s !== server);

      // Check health - should fail
      await router.checkRouteHealth(route.routeId);

      // Restart server
      await createHealthyServer(37052);

      // Check health - should succeed and reset failures
      const health = await router.checkRouteHealth(route.routeId);

      expect(health.healthy).toBe(true);
      const current = await router.getRoute('deploy-reset');
      expect(current!.status).toBe('active');
    });
  });

  describe('startHealthChecking / stopHealthChecking', () => {
    it('should start periodic health checking', async () => {
      vi.useFakeTimers();

      await createHealthyServer(37060);

      await router.registerRoute({
        deploymentId: 'deploy-periodic',
        projectId: 'project-123',
        subdomain: 'periodic-agent',
        targetHost: '127.0.0.1',
        targetPort: 37060,
      });

      router.startHealthChecking();

      // Advance time to trigger health check
      await vi.advanceTimersByTimeAsync(150);

      // Health check should have run
      const route = await router.getRoute('deploy-periodic');
      expect(route!.lastHealthCheck).toBeDefined();

      router.stopHealthChecking();
      vi.useRealTimers();
    });

    it('should not start multiple intervals', async () => {
      vi.useFakeTimers();

      // Start twice - should only have one interval
      router.startHealthChecking();
      router.startHealthChecking();

      // Should not throw on stop
      router.stopHealthChecking();

      vi.useRealTimers();
    });

    it('should stop health checking', async () => {
      vi.useFakeTimers();

      router.startHealthChecking();
      router.stopHealthChecking();

      // Advance time - no health checks should occur
      await vi.advanceTimersByTimeAsync(1000);

      // Should be able to stop again without error
      router.stopHealthChecking();

      vi.useRealTimers();
    });
  });

  describe('getAllRoutes', () => {
    it('should return all registered routes', async () => {
      await router.registerRoute({
        deploymentId: 'deploy-all-1',
        projectId: 'project-1',
        subdomain: 'agent-1',
        targetHost: '127.0.0.1',
        targetPort: 37070,
      });

      await router.registerRoute({
        deploymentId: 'deploy-all-2',
        projectId: 'project-2',
        subdomain: 'agent-2',
        targetHost: '127.0.0.1',
        targetPort: 37071,
      });

      const routes = router.getAllRoutes();

      expect(routes).toHaveLength(2);
    });

    it('should return empty array when no routes', () => {
      const routes = router.getAllRoutes();

      expect(routes).toEqual([]);
    });
  });

  describe('clearRoutes', () => {
    it('should remove all routes', async () => {
      await router.registerRoute({
        deploymentId: 'deploy-clear-1',
        projectId: 'project-1',
        subdomain: 'agent-1',
        targetHost: '127.0.0.1',
        targetPort: 37080,
      });

      await router.registerRoute({
        deploymentId: 'deploy-clear-2',
        projectId: 'project-2',
        subdomain: 'agent-2',
        targetHost: '127.0.0.1',
        targetPort: 37081,
      });

      router.clearRoutes();

      expect(router.getAllRoutes()).toEqual([]);
    });
  });

  describe('close', () => {
    it('should stop health checking and clear routes', async () => {
      vi.useFakeTimers();

      await router.registerRoute({
        deploymentId: 'deploy-close',
        projectId: 'project-123',
        subdomain: 'close-agent',
        targetHost: '127.0.0.1',
        targetPort: 37090,
      });

      router.startHealthChecking();

      await router.close();

      expect(router.getAllRoutes()).toEqual([]);

      vi.useRealTimers();
    });
  });

  describe('routing strategies', () => {
    it('should build port-mapping URL correctly', async () => {
      const portMappingRouter = new LocalEdgeRouter({
        strategy: 'port-mapping',
        logRoutes: false,
      });

      const route = await portMappingRouter.registerRoute({
        deploymentId: 'deploy-pm',
        projectId: 'project-123',
        subdomain: 'my-agent',
        targetHost: 'localhost',
        targetPort: 3001,
      });

      expect(route.publicUrl).toBe('http://localhost:3001');

      await portMappingRouter.close();
    });

    it('should build reverse-proxy URL with localhost (path-based)', async () => {
      const proxyRouter = new LocalEdgeRouter({
        strategy: 'reverse-proxy',
        baseDomain: 'localhost',
        proxyPort: 8080,
        logRoutes: false,
      });

      const route = await proxyRouter.registerRoute({
        deploymentId: 'deploy-proxy',
        projectId: 'project-123',
        subdomain: 'my-agent',
        targetHost: 'localhost',
        targetPort: 3001,
      });

      expect(route.publicUrl).toBe('http://localhost:8080/my-agent');

      await proxyRouter.close();
    });

    it('should build reverse-proxy URL with custom domain (subdomain-based)', async () => {
      const proxyRouter = new LocalEdgeRouter({
        strategy: 'reverse-proxy',
        baseDomain: 'mastra.local',
        proxyPort: 8080,
        logRoutes: false,
      });

      const route = await proxyRouter.registerRoute({
        deploymentId: 'deploy-custom',
        projectId: 'project-123',
        subdomain: 'my-agent',
        targetHost: 'localhost',
        targetPort: 3001,
      });

      expect(route.publicUrl).toBe('http://my-agent.mastra.local:8080');

      await proxyRouter.close();
    });

    it('should respect TLS setting in reverse-proxy mode', async () => {
      const proxyRouter = new LocalEdgeRouter({
        strategy: 'reverse-proxy',
        baseDomain: 'mastra.local',
        proxyPort: 443,
        logRoutes: false,
      });

      const route = await proxyRouter.registerRoute({
        deploymentId: 'deploy-tls-proxy',
        projectId: 'project-123',
        subdomain: 'secure-agent',
        targetHost: 'localhost',
        targetPort: 3001,
        tls: true,
      });

      expect(route.publicUrl).toBe('https://secure-agent.mastra.local:443');

      await proxyRouter.close();
    });
  });

  describe('full lifecycle', () => {
    it('should handle complete route lifecycle: register → update → health → remove', async () => {
      await createHealthyServer(37100);

      // Register
      const route = await router.registerRoute({
        deploymentId: 'deploy-lifecycle',
        projectId: 'project-lifecycle',
        subdomain: 'lifecycle-agent',
        targetHost: '127.0.0.1',
        targetPort: 37100,
      });

      expect(route.status).toBe('active');

      // Update
      const updated = await router.updateRoute(route.routeId, {
        subdomain: 'updated-lifecycle-agent',
      });

      expect(updated.routeId).toBe(route.routeId);

      // Health check
      const health = await router.checkRouteHealth(route.routeId);

      expect(health.healthy).toBe(true);

      // List
      const routes = await router.listRoutes('project-lifecycle');

      expect(routes).toHaveLength(1);

      // Remove
      await router.removeRoute(route.routeId);

      expect(await router.getRoute('deploy-lifecycle')).toBeNull();
    });

    it('should handle multiple routes per project with mixed health', async () => {
      await createHealthyServer(37101);
      // No server on 37102

      await router.registerRoute({
        deploymentId: 'deploy-multi-1',
        projectId: 'project-multi',
        subdomain: 'healthy-agent',
        targetHost: '127.0.0.1',
        targetPort: 37101,
      });

      await router.registerRoute({
        deploymentId: 'deploy-multi-2',
        projectId: 'project-multi',
        subdomain: 'unhealthy-agent',
        targetHost: '127.0.0.1',
        targetPort: 37996,
      });

      const routes = await router.listRoutes('project-multi');

      expect(routes).toHaveLength(2);

      const healthyRoute = routes.find(r => r.deploymentId === 'deploy-multi-1');
      const unhealthyRoute = routes.find(r => r.deploymentId === 'deploy-multi-2');

      expect(healthyRoute!.status).toBe('active');
      expect(unhealthyRoute!.status).toBe('pending');
    });
  });
});
