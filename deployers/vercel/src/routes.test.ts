import { describe, expect, it } from 'vitest';
import { getVercelRoutes } from './routes';

describe('getVercelRoutes', () => {
  const studioRouteRoots = ['agents', 'agent-builder', 'workflows'];

  type Routes = ReturnType<typeof getVercelRoutes>;

  const findRouteIndex = (routes: Routes, predicate: (route: Routes[number]) => boolean) => {
    const index = routes.findIndex(predicate);
    expect(index).toBeGreaterThanOrEqual(0);
    return index;
  };

  /**
   * Mirrors Vercel's Build Output API route matching: sources are checked in order, and the
   * routes after `handle: filesystem` only apply once the static filesystem misses.
   * https://vercel.com/docs/build-output-api/configuration
   */
  const resolve = (routes: Routes, path: string) => {
    const filesystemIndex = routes.findIndex(route => 'handle' in route);
    const phases = [
      routes.slice(0, filesystemIndex === -1 ? routes.length : filesystemIndex),
      routes.slice(filesystemIndex + 1),
    ];

    for (const phase of phases) {
      for (const route of phase) {
        if (!('src' in route)) continue;
        if (new RegExp(route.src).test(path)) {
          return route.dest === '/' ? 'function' : route.dest;
        }
      }
    }

    return 'filesystem';
  };

  it('routes the studio root to the static index before filesystem matching', () => {
    const routes = getVercelRoutes({ studio: true, studioRouteRoots });
    const rootIndex = findRouteIndex(
      routes,
      route => 'src' in route && route.src === '^/$' && route.dest === '/index.html',
    );
    const filesystemIndex = findRouteIndex(routes, route => 'handle' in route && route.handle === 'filesystem');

    expect(rootIndex).toBeLessThan(filesystemIndex);
  });

  it('serves studio SPA routes from the static index', () => {
    const routes = getVercelRoutes({ studio: true, studioRouteRoots });

    for (const path of ['/agents', '/agents/weather-agent/chat', '/agent-builder', '/workflows']) {
      expect(resolve(routes, path)).toBe('/index.html');
    }
  });

  it('routes custom api routes to the function instead of the studio SPA', () => {
    const routes = getVercelRoutes({ studio: true, studioRouteRoots });

    for (const path of ['/my/webhook', '/inngest/api', '/chat']) {
      expect(resolve(routes, path)).toBe('function');
    }
  });

  it('keeps server endpoints routed to the function', () => {
    const routes = getVercelRoutes({ studio: true, studioRouteRoots });

    for (const path of ['/api/agents', '/health']) {
      expect(resolve(routes, path)).toBe('function');
    }
  });

  it('routes a non-default apiPrefix to the function', () => {
    const routes = getVercelRoutes({ studio: true, studioRouteRoots });

    expect(resolve(routes, '/mastra/agents')).toBe('function');
  });

  it('leaves static assets to filesystem matching', () => {
    const routes = getVercelRoutes({ studio: true, studioRouteRoots });
    const filesystemIndex = findRouteIndex(routes, route => 'handle' in route && route.handle === 'filesystem');

    for (const path of ['/assets/index-egSSWNcT.js', '/mastra.svg']) {
      const matchedBeforeFilesystem = routes
        .slice(0, filesystemIndex)
        .some(route => 'src' in route && new RegExp(route.src).test(path));

      expect(matchedBeforeFilesystem).toBe(false);
    }
  });

  it('escapes regex characters in studio route segments', () => {
    const routes = getVercelRoutes({ studio: true, studioRouteRoots: ['a.b'] });

    expect(resolve(routes, '/a.b')).toBe('/index.html');
    expect(resolve(routes, '/axb')).toBe('function');
  });

  it('sends everything to the function when no studio routes are known', () => {
    const routes = getVercelRoutes({ studio: true, studioRouteRoots: [] });

    expect(resolve(routes, '/my/webhook')).toBe('function');
    expect(resolve(routes, '/')).toBe('/index.html');
  });

  it('routes all requests to the function when studio is disabled', () => {
    const routes = getVercelRoutes({ studio: false });

    expect(routes).toHaveLength(1);
    expect(routes[0]).toMatchObject({ src: '/(.*)', dest: '/' });
  });
});
