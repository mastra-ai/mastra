import { describe, expect, it } from 'vitest';
import { getVercelRoutes } from './routes';

describe('getVercelRoutes', () => {
  const findRouteIndex = (
    routes: ReturnType<typeof getVercelRoutes>,
    predicate: (route: ReturnType<typeof getVercelRoutes>[number]) => boolean,
  ) => {
    const index = routes.findIndex(predicate);
    expect(index).toBeGreaterThanOrEqual(0);
    return index;
  };

  it('routes the studio root to the static index before filesystem matching', () => {
    const routes = getVercelRoutes({ studio: true });
    const rootIndex = findRouteIndex(
      routes,
      route => 'src' in route && route.src === '^/$' && route.dest === '/index.html',
    );
    const filesystemIndex = findRouteIndex(routes, route => 'handle' in route && route.handle === 'filesystem');

    expect(rootIndex).toBeLessThan(filesystemIndex);
  });

  it('keeps server endpoints routed to the function before filesystem matching', () => {
    const routes = getVercelRoutes({ studio: true });
    const filesystemIndex = findRouteIndex(routes, route => 'handle' in route && route.handle === 'filesystem');

    for (const src of ['/api/(.*)', '/health']) {
      const routeIndex = findRouteIndex(routes, route => 'src' in route && route.src === src && route.dest === '/');
      expect(routeIndex).toBeLessThan(filesystemIndex);
    }
  });

  it('routes all requests to the function when studio is disabled', () => {
    const routes = getVercelRoutes({ studio: false });

    expect(routes).toHaveLength(1);
    expect(routes[0]).toMatchObject({ src: '/(.*)', dest: '/' });
  });
});
