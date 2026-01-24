import { describe, it, expect, beforeEach } from 'vitest';

import { RouteRegistry } from './registry';
import type { LocalRoute } from './types';

function createRoute(overrides: Partial<LocalRoute> = {}): LocalRoute {
  return {
    routeId: `route_${Math.random().toString(36).slice(2, 10)}`,
    deploymentId: `deploy_${Math.random().toString(36).slice(2, 10)}`,
    projectId: `project_${Math.random().toString(36).slice(2, 10)}`,
    subdomain: 'test-subdomain',
    targetHost: 'localhost',
    targetPort: 3001,
    publicUrl: 'http://localhost:3001',
    status: 'pending',
    tls: false,
    createdAt: new Date(),
    healthCheckFailures: 0,
    ...overrides,
  };
}

describe('RouteRegistry', () => {
  let registry: RouteRegistry;

  beforeEach(() => {
    registry = new RouteRegistry();
  });

  describe('add', () => {
    it('should add a route to the registry', () => {
      const route = createRoute();

      registry.add(route);

      const retrieved = registry.get(route.routeId);
      expect(retrieved).toEqual(route);
    });

    it('should index route by deployment ID', () => {
      const route = createRoute();

      registry.add(route);

      const retrieved = registry.getByDeploymentId(route.deploymentId);
      expect(retrieved).toEqual(route);
    });

    it('should index route by project ID', () => {
      const route = createRoute();

      registry.add(route);

      const routes = registry.listByProjectId(route.projectId);
      expect(routes).toHaveLength(1);
      expect(routes[0]).toEqual(route);
    });

    it('should handle multiple routes for same project', () => {
      const projectId = 'shared-project';
      const route1 = createRoute({ projectId });
      const route2 = createRoute({ projectId });

      registry.add(route1);
      registry.add(route2);

      const routes = registry.listByProjectId(projectId);
      expect(routes).toHaveLength(2);
      expect(routes).toContainEqual(route1);
      expect(routes).toContainEqual(route2);
    });

    it('should overwrite route with same routeId', () => {
      const routeId = 'route_test123';
      const route1 = createRoute({ routeId, subdomain: 'original' });
      const route2 = createRoute({ routeId, subdomain: 'updated' });

      registry.add(route1);
      registry.add(route2);

      const retrieved = registry.get(routeId);
      expect(retrieved?.subdomain).toBe('updated');
    });
  });

  describe('get', () => {
    it('should return route by ID', () => {
      const route = createRoute();
      registry.add(route);

      const retrieved = registry.get(route.routeId);

      expect(retrieved).toEqual(route);
    });

    it('should return undefined for non-existent route', () => {
      const retrieved = registry.get('non-existent-id');

      expect(retrieved).toBeUndefined();
    });
  });

  describe('getByDeploymentId', () => {
    it('should return route by deployment ID', () => {
      const route = createRoute();
      registry.add(route);

      const retrieved = registry.getByDeploymentId(route.deploymentId);

      expect(retrieved).toEqual(route);
    });

    it('should return undefined for non-existent deployment', () => {
      const retrieved = registry.getByDeploymentId('non-existent-deployment');

      expect(retrieved).toBeUndefined();
    });

    it('should return correct route when multiple routes exist', () => {
      const route1 = createRoute();
      const route2 = createRoute();
      registry.add(route1);
      registry.add(route2);

      expect(registry.getByDeploymentId(route1.deploymentId)).toEqual(route1);
      expect(registry.getByDeploymentId(route2.deploymentId)).toEqual(route2);
    });
  });

  describe('listByProjectId', () => {
    it('should return all routes for a project', () => {
      const projectId = 'test-project';
      const route1 = createRoute({ projectId });
      const route2 = createRoute({ projectId });
      const route3 = createRoute({ projectId: 'other-project' });

      registry.add(route1);
      registry.add(route2);
      registry.add(route3);

      const routes = registry.listByProjectId(projectId);

      expect(routes).toHaveLength(2);
      expect(routes).toContainEqual(route1);
      expect(routes).toContainEqual(route2);
      expect(routes).not.toContainEqual(route3);
    });

    it('should return empty array for non-existent project', () => {
      const routes = registry.listByProjectId('non-existent-project');

      expect(routes).toEqual([]);
    });

    it('should handle project with no remaining routes after removal', () => {
      const projectId = 'test-project';
      const route = createRoute({ projectId });
      registry.add(route);
      registry.remove(route.routeId);

      const routes = registry.listByProjectId(projectId);

      expect(routes).toEqual([]);
    });
  });

  describe('update', () => {
    it('should update route properties', () => {
      const route = createRoute({ subdomain: 'original', targetPort: 3001 });
      registry.add(route);

      const updated = registry.update(route.routeId, {
        subdomain: 'updated',
        targetPort: 3002,
      });

      expect(updated).toBeDefined();
      expect(updated?.subdomain).toBe('updated');
      expect(updated?.targetPort).toBe(3002);
    });

    it('should return undefined for non-existent route', () => {
      const updated = registry.update('non-existent-id', { subdomain: 'test' });

      expect(updated).toBeUndefined();
    });

    it('should preserve unmodified properties', () => {
      const route = createRoute({ subdomain: 'original', targetPort: 3001, tls: false });
      registry.add(route);

      const updated = registry.update(route.routeId, { subdomain: 'updated' });

      expect(updated?.targetPort).toBe(3001);
      expect(updated?.tls).toBe(false);
    });

    it('should update health check metadata', () => {
      const route = createRoute({ healthCheckFailures: 0 });
      registry.add(route);
      const lastHealthCheck = new Date();

      const updated = registry.update(route.routeId, {
        healthCheckFailures: 2,
        lastHealthCheck,
      });

      expect(updated?.healthCheckFailures).toBe(2);
      expect(updated?.lastHealthCheck).toEqual(lastHealthCheck);
    });

    it('should persist update to registry', () => {
      const route = createRoute();
      registry.add(route);

      registry.update(route.routeId, { status: 'active' });
      const retrieved = registry.get(route.routeId);

      expect(retrieved?.status).toBe('active');
    });
  });

  describe('remove', () => {
    it('should remove route from registry', () => {
      const route = createRoute();
      registry.add(route);

      const removed = registry.remove(route.routeId);

      expect(removed).toBe(true);
      expect(registry.get(route.routeId)).toBeUndefined();
    });

    it('should return false for non-existent route', () => {
      const removed = registry.remove('non-existent-id');

      expect(removed).toBe(false);
    });

    it('should remove deployment ID index', () => {
      const route = createRoute();
      registry.add(route);

      registry.remove(route.routeId);

      expect(registry.getByDeploymentId(route.deploymentId)).toBeUndefined();
    });

    it('should remove from project ID index', () => {
      const route = createRoute();
      registry.add(route);

      registry.remove(route.routeId);

      const routes = registry.listByProjectId(route.projectId);
      expect(routes).toEqual([]);
    });

    it('should only remove specified route from project', () => {
      const projectId = 'shared-project';
      const route1 = createRoute({ projectId });
      const route2 = createRoute({ projectId });
      registry.add(route1);
      registry.add(route2);

      registry.remove(route1.routeId);

      const routes = registry.listByProjectId(projectId);
      expect(routes).toHaveLength(1);
      expect(routes[0]).toEqual(route2);
    });

    it('should clean up empty project set', () => {
      const projectId = 'test-project';
      const route = createRoute({ projectId });
      registry.add(route);

      registry.remove(route.routeId);

      // Verify internal cleanup by adding another route to same project
      const route2 = createRoute({ projectId });
      registry.add(route2);
      const routes = registry.listByProjectId(projectId);
      expect(routes).toHaveLength(1);
    });
  });

  describe('all', () => {
    it('should return empty array when no routes', () => {
      const routes = registry.all();

      expect(routes).toEqual([]);
    });

    it('should return all routes', () => {
      const route1 = createRoute();
      const route2 = createRoute();
      const route3 = createRoute();
      registry.add(route1);
      registry.add(route2);
      registry.add(route3);

      const routes = registry.all();

      expect(routes).toHaveLength(3);
      expect(routes).toContainEqual(route1);
      expect(routes).toContainEqual(route2);
      expect(routes).toContainEqual(route3);
    });

    it('should reflect removals', () => {
      const route1 = createRoute();
      const route2 = createRoute();
      registry.add(route1);
      registry.add(route2);

      registry.remove(route1.routeId);

      const routes = registry.all();
      expect(routes).toHaveLength(1);
      expect(routes[0]).toEqual(route2);
    });
  });

  describe('clear', () => {
    it('should remove all routes', () => {
      const route1 = createRoute();
      const route2 = createRoute();
      registry.add(route1);
      registry.add(route2);

      registry.clear();

      expect(registry.all()).toEqual([]);
    });

    it('should clear all indexes', () => {
      const route = createRoute();
      registry.add(route);

      registry.clear();

      expect(registry.get(route.routeId)).toBeUndefined();
      expect(registry.getByDeploymentId(route.deploymentId)).toBeUndefined();
      expect(registry.listByProjectId(route.projectId)).toEqual([]);
    });

    it('should allow adding routes after clear', () => {
      const route1 = createRoute();
      registry.add(route1);
      registry.clear();

      const route2 = createRoute();
      registry.add(route2);

      expect(registry.all()).toHaveLength(1);
      expect(registry.get(route2.routeId)).toEqual(route2);
    });
  });
});
