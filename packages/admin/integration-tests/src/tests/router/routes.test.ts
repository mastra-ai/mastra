import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { MockEdgeRouter } from '../../setup/mock-router.js';

describe('Local Edge Router Integration Tests', () => {
  let router: MockEdgeRouter;

  beforeAll(async () => {
    router = new MockEdgeRouter({
      baseDomain: 'localhost',
      portRange: { start: 4500, end: 4599 },
    });
  });

  afterAll(async () => {
    await router.shutdown();
  });

  beforeEach(() => {
    router.clear();
  });

  describe('Route Registration', () => {
    it('should register a route', async () => {
      const route = await router.registerRoute({
        deploymentId: 'deploy-1',
        projectId: 'project-1',
        subdomain: 'test-agent',
        targetHost: 'localhost',
        targetPort: 3001,
      });

      expect(route.routeId).toBeDefined();
      expect(route.publicUrl).toContain('localhost');
      expect(route.status).toBe('active');
      expect(route.deploymentId).toBe('deploy-1');
      expect(route.createdAt).toBeInstanceOf(Date);
    });

    it('should generate unique route IDs', async () => {
      const route1 = await router.registerRoute({
        deploymentId: 'deploy-1',
        projectId: 'project-1',
        subdomain: 'agent-1',
        targetHost: 'localhost',
        targetPort: 3001,
      });

      const route2 = await router.registerRoute({
        deploymentId: 'deploy-2',
        projectId: 'project-1',
        subdomain: 'agent-2',
        targetHost: 'localhost',
        targetPort: 3002,
      });

      expect(route1.routeId).not.toBe(route2.routeId);
    });

    it('should include subdomain in public URL', async () => {
      const route = await router.registerRoute({
        deploymentId: 'deploy-1',
        projectId: 'project-1',
        subdomain: 'my-agent',
        targetHost: 'localhost',
        targetPort: 3001,
      });

      expect(route.publicUrl).toContain('my-agent');
    });

    it('should retrieve registered route by deployment ID', async () => {
      const registered = await router.registerRoute({
        deploymentId: 'deploy-2',
        projectId: 'project-1',
        subdomain: 'another-agent',
        targetHost: 'localhost',
        targetPort: 3002,
      });

      const fetched = await router.getRoute('deploy-2');

      expect(fetched).not.toBeNull();
      expect(fetched!.routeId).toBe(registered.routeId);
      expect(fetched!.deploymentId).toBe('deploy-2');
      expect(fetched!.publicUrl).toBe(registered.publicUrl);
    });

    it('should return null for non-existent deployment', async () => {
      const route = await router.getRoute('non-existent-deployment');
      expect(route).toBeNull();
    });

    it('should update route target', async () => {
      const route = await router.registerRoute({
        deploymentId: 'deploy-3',
        projectId: 'project-1',
        subdomain: 'update-agent',
        targetHost: 'localhost',
        targetPort: 3003,
      });

      const updated = await router.updateRoute(route.routeId, {
        targetPort: 3004,
      });

      expect(updated.routeId).toBe(route.routeId);
      expect(updated.publicUrl).toBeDefined();
    });

    it('should throw error when updating non-existent route', async () => {
      await expect(
        router.updateRoute('non-existent-route', { targetPort: 3000 }),
      ).rejects.toThrow(/not found/i);
    });

    it('should remove route', async () => {
      const route = await router.registerRoute({
        deploymentId: 'deploy-4',
        projectId: 'project-1',
        subdomain: 'remove-agent',
        targetHost: 'localhost',
        targetPort: 3005,
      });

      await router.removeRoute(route.routeId);

      const fetched = await router.getRoute('deploy-4');
      expect(fetched).toBeNull();
    });

    it('should not throw when removing non-existent route', async () => {
      await expect(router.removeRoute('non-existent-route')).resolves.not.toThrow();
    });

    it('should list routes for project', async () => {
      const projectId = `project-${Date.now()}`;

      await router.registerRoute({
        deploymentId: 'deploy-5',
        projectId,
        subdomain: 'list-agent-1',
        targetHost: 'localhost',
        targetPort: 3006,
      });

      await router.registerRoute({
        deploymentId: 'deploy-6',
        projectId,
        subdomain: 'list-agent-2',
        targetHost: 'localhost',
        targetPort: 3007,
      });

      const routes = await router.listRoutes(projectId);

      // Note: MockEdgeRouter doesn't filter by projectId, so we check the count
      expect(routes.length).toBe(2);
    });

    it('should return empty list for project with no routes', async () => {
      router.clear();
      const routes = await router.listRoutes('non-existent-project');
      expect(routes).toEqual([]);
    });
  });

  describe('Route Health Checking', () => {
    it('should report unhealthy for non-running target', async () => {
      const route = await router.registerRoute({
        deploymentId: 'deploy-health-1',
        projectId: 'project-health',
        subdomain: 'health-agent',
        targetHost: 'localhost',
        targetPort: 39999, // Non-existent port
      });

      const health = await router.checkRouteHealth(route.routeId);

      expect(health.healthy).toBe(false);
      expect(health.error).toBeDefined();
    });

    it('should return unhealthy status for non-existent route', async () => {
      const health = await router.checkRouteHealth('non-existent-route');

      expect(health.healthy).toBe(false);
      expect(health.error).toContain('not found');
    });
  });

  describe('Port Allocation', () => {
    it('should allocate sequential ports', async () => {
      const route1 = await router.registerRoute({
        deploymentId: 'deploy-port-1',
        projectId: 'project-port',
        subdomain: 'port-agent-1',
        targetHost: 'localhost',
        targetPort: 3000,
      });

      const route2 = await router.registerRoute({
        deploymentId: 'deploy-port-2',
        projectId: 'project-port',
        subdomain: 'port-agent-2',
        targetHost: 'localhost',
        targetPort: 3001,
      });

      // Extract ports from URLs
      const port1 = parseInt(route1.publicUrl.split(':').pop()!);
      const port2 = parseInt(route2.publicUrl.split(':').pop()!);

      expect(port2).toBe(port1 + 1);
    });

    it('should wrap around when reaching end of port range', async () => {
      // Create a router with small port range
      const smallRouter = new MockEdgeRouter({
        baseDomain: 'localhost',
        portRange: { start: 5000, end: 5001 },
      });

      const route1 = await smallRouter.registerRoute({
        deploymentId: 'deploy-wrap-1',
        projectId: 'project-wrap',
        subdomain: 'wrap-agent-1',
        targetHost: 'localhost',
        targetPort: 3000,
      });

      const route2 = await smallRouter.registerRoute({
        deploymentId: 'deploy-wrap-2',
        projectId: 'project-wrap',
        subdomain: 'wrap-agent-2',
        targetHost: 'localhost',
        targetPort: 3001,
      });

      const route3 = await smallRouter.registerRoute({
        deploymentId: 'deploy-wrap-3',
        projectId: 'project-wrap',
        subdomain: 'wrap-agent-3',
        targetHost: 'localhost',
        targetPort: 3002,
      });

      const port1 = parseInt(route1.publicUrl.split(':').pop()!);
      const port2 = parseInt(route2.publicUrl.split(':').pop()!);
      const port3 = parseInt(route3.publicUrl.split(':').pop()!);

      expect(port1).toBe(5000);
      expect(port2).toBe(5001);
      expect(port3).toBe(5000); // Should wrap around

      await smallRouter.shutdown();
    });
  });

  describe('Route Isolation', () => {
    it('should not affect other routes when removing one', async () => {
      const route1 = await router.registerRoute({
        deploymentId: 'deploy-iso-1',
        projectId: 'project-iso',
        subdomain: 'iso-agent-1',
        targetHost: 'localhost',
        targetPort: 3000,
      });

      const route2 = await router.registerRoute({
        deploymentId: 'deploy-iso-2',
        projectId: 'project-iso',
        subdomain: 'iso-agent-2',
        targetHost: 'localhost',
        targetPort: 3001,
      });

      // Remove first route
      await router.removeRoute(route1.routeId);

      // Second route should still exist
      const fetched = await router.getRoute('deploy-iso-2');
      expect(fetched).not.toBeNull();
      expect(fetched!.routeId).toBe(route2.routeId);
    });

    it('should handle multiple registrations for same deployment', async () => {
      // Register first route
      await router.registerRoute({
        deploymentId: 'deploy-dup',
        projectId: 'project-dup',
        subdomain: 'dup-agent',
        targetHost: 'localhost',
        targetPort: 3000,
      });

      // Register second route for same deployment (should overwrite)
      const route2 = await router.registerRoute({
        deploymentId: 'deploy-dup',
        projectId: 'project-dup',
        subdomain: 'dup-agent-new',
        targetHost: 'localhost',
        targetPort: 3001,
      });

      // Should get the second route
      const fetched = await router.getRoute('deploy-dup');
      expect(fetched).not.toBeNull();
      expect(fetched!.routeId).toBe(route2.routeId);
    });
  });

  describe('Shutdown', () => {
    it('should clear all routes on shutdown', async () => {
      const testRouter = new MockEdgeRouter();

      await testRouter.registerRoute({
        deploymentId: 'deploy-shutdown-1',
        projectId: 'project-shutdown',
        subdomain: 'shutdown-agent',
        targetHost: 'localhost',
        targetPort: 3000,
      });

      expect(testRouter.getRouteCount()).toBe(1);

      await testRouter.shutdown();

      expect(testRouter.getRouteCount()).toBe(0);
    });
  });
});
