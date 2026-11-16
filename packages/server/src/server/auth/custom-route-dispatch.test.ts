import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';

import { CustomRouteMatcher } from './custom-route-matcher';
import { findMatchingCustomRoute, isCustomRoutePublic, isProtectedCustomRoute } from './helpers';

type Route = { method: string; path: string; requiresAuth: boolean };

const toConfig = (routes: Route[]) => new Map(routes.map(r => [`${r.method}:${r.path}`, r.requiresAuth]));

/**
 * Builds the custom-route app the way `buildCustomRouteHandler` does (global
 * middleware, then each route in registration order) and reports which route
 * actually handled a raw request, or -1 for none.
 */
const dispatch = async (routes: Route[], rawPath: string, method: string) => {
  const app = new Hono();
  app.use('*', async (_c, next) => {
    await next();
  });
  routes.forEach((route, index) => {
    const handler = (c: any) => c.text('', 200, { 'x-route': String(index) });
    if (route.method === 'ALL') app.all(route.path, handler);
    else app.on(route.method, route.path, handler);
  });
  app.notFound(c => c.text('', 404, { 'x-route': '-1' }));
  const request = new Request(`http://localhost${rawPath}`, { method });
  const response = await app.fetch(request);
  return { index: Number(response.headers.get('x-route') ?? -1), honoPath: app.getPath(request) };
};

describe('custom route auth follows Hono dispatch', () => {
  // The exact report: a public parameterized route registered before a protected
  // static one. In this Hono version the inner app dispatches '/admin/public' to
  // the earlier '/admin/:id' (first match), so the protected handler never runs.
  // The path is still registered as protected, so the auth middleware keeps
  // requiring auth on it (fail closed).
  it('public /admin/:id before protected /admin/public', async () => {
    const routes: Route[] = [
      { method: 'GET', path: '/admin/:id', requiresAuth: false },
      { method: 'GET', path: '/admin/public', requiresAuth: true },
    ];
    expect((await dispatch(routes, '/admin/public', 'GET')).index).toBe(0);
    expect(findMatchingCustomRoute('/admin/public', 'GET', routes as any)?.route.path).toBe('/admin/:id');
    expect(isProtectedCustomRoute('/admin/public', 'GET', toConfig(routes))).toBe(true);
    expect(isCustomRoutePublic('/admin/public', 'GET', toConfig(routes))).toBe(false);
    expect(isCustomRoutePublic('/admin/other', 'GET', toConfig(routes))).toBe(true);
  });

  it('protected /admin/:id before public /admin/public', async () => {
    const routes: Route[] = [
      { method: 'GET', path: '/admin/:id', requiresAuth: true },
      { method: 'GET', path: '/admin/public', requiresAuth: false },
    ];
    expect((await dispatch(routes, '/admin/public', 'GET')).index).toBe(0);
    expect(isProtectedCustomRoute('/admin/public', 'GET', toConfig(routes))).toBe(true);
    expect(isCustomRoutePublic('/admin/public', 'GET', toConfig(routes))).toBe(false);
  });

  it('protected static before public param still protects the static path', async () => {
    const routes: Route[] = [
      { method: 'GET', path: '/admin/settings', requiresAuth: true },
      { method: 'GET', path: '/admin/:id', requiresAuth: false },
    ];
    expect((await dispatch(routes, '/admin/settings', 'GET')).index).toBe(0);
    expect(isProtectedCustomRoute('/admin/settings', 'GET', toConfig(routes))).toBe(true);
    expect(isCustomRoutePublic('/admin/x', 'GET', toConfig(routes))).toBe(true);
  });

  it('matches case-sensitively, like Hono', async () => {
    const routes: Route[] = [
      { method: 'GET', path: '/Admin', requiresAuth: false },
      { method: 'GET', path: '/admin', requiresAuth: true },
    ];
    expect((await dispatch(routes, '/admin', 'GET')).index).toBe(1);
    expect(isProtectedCustomRoute('/admin', 'GET', toConfig(routes))).toBe(true);
    expect(isCustomRoutePublic('/admin', 'GET', toConfig(routes))).toBe(false);
    // '/ADMIN' isn't dispatched to any custom route, so it isn't public either.
    expect((await dispatch(routes, '/ADMIN', 'GET')).index).toBe(-1);
    expect(isCustomRoutePublic('/ADMIN', 'GET', toConfig(routes))).toBe(false);
  });

  it('treats HEAD like GET, as Hono does', async () => {
    const routes: Route[] = [{ method: 'GET', path: '/secret', requiresAuth: true }];
    expect((await dispatch(routes, '/secret', 'HEAD')).index).toBe(0);
    expect(isProtectedCustomRoute('/secret', 'HEAD', toConfig(routes))).toBe(true);

    const publicRoutes: Route[] = [
      { method: 'GET', path: '/files/:name', requiresAuth: false },
      { method: 'GET', path: '/files/secret', requiresAuth: true },
    ];
    expect(isProtectedCustomRoute('/files/secret', 'HEAD', toConfig(publicRoutes))).toBe(true);
  });

  it('includes the method in the match, so the same path can differ by method', async () => {
    const routes: Route[] = [
      { method: 'GET', path: '/items/:id', requiresAuth: false },
      { method: 'DELETE', path: '/items/:id', requiresAuth: true },
    ];
    expect(isCustomRoutePublic('/items/1', 'GET', toConfig(routes))).toBe(true);
    expect(isProtectedCustomRoute('/items/1', 'DELETE', toConfig(routes))).toBe(true);
    expect(isCustomRoutePublic('/items/1', 'DELETE', toConfig(routes))).toBe(false);
    // No POST route: nothing is dispatched, so it's not public.
    expect(isCustomRoutePublic('/items/1', 'POST', toConfig(routes))).toBe(false);
    // HEAD is served by the GET route, so it's public too, and DELETE stays protected.
    expect(isCustomRoutePublic('/items/1', 'HEAD', toConfig(routes))).toBe(true);
  });

  it('handles ALL and wildcard routes in registration order', async () => {
    const routes: Route[] = [
      { method: 'ALL', path: '/hooks/*', requiresAuth: false },
      { method: 'POST', path: '/hooks/admin', requiresAuth: true },
    ];
    // ALL '/hooks/*' is registered first, so Hono runs it for POST /hooks/admin.
    expect((await dispatch(routes, '/hooks/admin', 'POST')).index).toBe(0);
    // ...but '/hooks/admin' itself is registered as protected, so stay closed.
    expect(isCustomRoutePublic('/hooks/admin', 'POST', toConfig(routes))).toBe(false);
    expect(isCustomRoutePublic('/hooks/github', 'POST', toConfig(routes))).toBe(true);
    expect(isCustomRoutePublic('/hooks/github', 'DELETE', toConfig(routes))).toBe(true);

    const protectedAll: Route[] = [
      { method: 'ALL', path: '/internal/*', requiresAuth: true },
      { method: 'GET', path: '/internal/health', requiresAuth: false },
    ];
    expect((await dispatch(protectedAll, '/internal/health', 'GET')).index).toBe(0);
    expect(isProtectedCustomRoute('/internal/health', 'GET', toConfig(protectedAll))).toBe(true);
    expect(isProtectedCustomRoute('/internal/x', 'OPTIONS', toConfig(protectedAll))).toBe(true);

    // Wildcards are case-sensitive too: '/Hooks/*' doesn't serve '/hooks/x'.
    const caseWildcards: Route[] = [
      { method: 'ALL', path: '/Hooks/*', requiresAuth: false },
      { method: 'ALL', path: '/hooks/*', requiresAuth: true },
    ];
    expect((await dispatch(caseWildcards, '/hooks/x', 'POST')).index).toBe(1);
    expect(isProtectedCustomRoute('/hooks/x', 'POST', toConfig(caseWildcards))).toBe(true);
    expect(isCustomRoutePublic('/Hooks/x', 'POST', toConfig(caseWildcards))).toBe(true);
  });

  it('a pinned public entry for the request path cannot override an earlier protected route', () => {
    // Adapters append `METHOD:path` to a copy of the map for the current request.
    const config = toConfig([
      { method: 'GET', path: '/admin/:id', requiresAuth: true },
      { method: 'GET', path: '/open', requiresAuth: false },
    ]);
    const pinned = new Map(config).set('GET:/admin/x', false);
    expect(isCustomRoutePublic('/admin/x', 'GET', pinned)).toBe(false);
    expect(isProtectedCustomRoute('/admin/x', 'GET', pinned)).toBe(true);

    // With nothing registered before it, the pinned entry decides.
    const pinnedOnly = new Map(config).set('GET:/elsewhere', false);
    expect(isCustomRoutePublic('/elsewhere', 'GET', pinnedOnly)).toBe(true);
    const pinnedProtected = new Map(config).set('GET:/open', true);
    expect(isCustomRoutePublic('/open', 'GET', pinnedProtected)).toBe(false);
  });

  it('defaults to not public when no custom route matches', () => {
    const routes: Route[] = [{ method: 'GET', path: '/public', requiresAuth: false }];
    expect(isCustomRoutePublic('/elsewhere', 'GET', toConfig(routes))).toBe(false);
    expect(isProtectedCustomRoute('/elsewhere', 'GET', toConfig(routes))).toBe(false);
  });

  describe('path normalization', () => {
    // Public catch-alls before protected routes: any reading of the path that the
    // inner app sends to a protected handler must be treated as protected.
    const routes: Route[] = [
      { method: 'GET', path: '/admin', requiresAuth: true },
      { method: 'GET', path: '/admin/*', requiresAuth: true },
      { method: 'GET', path: '/public/*', requiresAuth: false },
      { method: 'GET', path: '/docs', requiresAuth: false },
      { method: 'GET', path: '/:page', requiresAuth: false },
      { method: 'GET', path: '/*', requiresAuth: true },
    ];
    const config = toConfig(routes);

    it.each([
      // percent-encoded letters decode to '/admin'
      ['/%61dmin'],
      ['/%61dmin/users'],
      // encoded dot segments are resolved by the URL parser before dispatch
      ['/public/%2e%2e/admin'],
      ['/public/%2E%2E/admin/users'],
      ['/public/../admin'],
      ['/public/.%2e/admin'],
      // trailing slash: Hono is strict, so '/docs/' isn't '/docs'
      ['/docs/'],
      // double slash
      ['//admin'],
      ['/docs//x'],
    ])('%s is protected exactly when Hono dispatches it to a protected route', async rawPath => {
      const { index, honoPath } = await dispatch(routes, rawPath, 'GET');
      const dispatched = routes[index];
      // Raw path (Express/Koa/Fastify) and the decoded path (Hono) must both agree.
      for (const path of [rawPath, honoPath]) {
        if (!dispatched || dispatched.requiresAuth) {
          expect(isCustomRoutePublic(path, 'GET', config)).toBe(false);
        }
        if (dispatched?.requiresAuth) {
          expect(isProtectedCustomRoute(path, 'GET', config)).toBe(true);
        }
      }
    });

    it('does not let an encoded slash reach a different route', async () => {
      // '%2F' is not decoded by decodeURI, so Hono sees one segment, as do we.
      const { index, honoPath } = await dispatch(routes, '/admin%2Fusers', 'GET');
      expect(routes[index]?.path).toBe('/:page');
      expect(isCustomRoutePublic(honoPath, 'GET', config)).toBe(true);
      expect(isCustomRoutePublic('/admin%2Fusers', 'GET', config)).toBe(true);
    });

    it('ignores the query string when given a full URL', () => {
      const matcher = new CustomRouteMatcher(routes);
      expect(matcher.matchUrl('http://localhost/admin?next=/public/x', 'GET')?.entry.path).toBe('/admin');
      expect(matcher.matchUrl('http://localhost/public/x?/admin', 'GET')?.entry.path).toBe('/public/*');
    });

    it('a crafted Host header cannot move the dispatched path away from the matched one', async () => {
      // Adapters forward `${protocol}://${host}${url}`. Matching the same string
      // means auth sees whatever path the inner app will dispatch.
      const matcher = new CustomRouteMatcher(routes);
      const url = 'http://evil/admin?/public/x';
      const response = await (async () => {
        const app = new Hono();
        routes.forEach((r, i) => app.on(r.method, r.path, c => c.text(String(i))));
        return app.fetch(new Request(url));
      })();
      expect(routes[Number(await response.text())]?.path).toBe('/admin');
      expect(matcher.matchUrl(url, 'GET')?.entry.path).toBe('/admin');
    });
  });

  it('agrees with real Hono dispatch across overlapping route tables', async () => {
    const tables: Route[][] = [
      [
        { method: 'GET', path: '/a/:id', requiresAuth: false },
        { method: 'GET', path: '/a/b', requiresAuth: true },
      ],
      [
        { method: 'GET', path: '/a/b', requiresAuth: true },
        { method: 'GET', path: '/a/:id', requiresAuth: false },
      ],
      [
        { method: 'ALL', path: '/a/*', requiresAuth: true },
        { method: 'GET', path: '/a/:id', requiresAuth: false },
      ],
      [
        { method: 'GET', path: '/a/:id/:sub?', requiresAuth: false },
        { method: 'GET', path: '/a/x/y', requiresAuth: true },
      ],
      [
        { method: 'GET', path: '/a/:id{[0-9]+}', requiresAuth: false },
        { method: 'GET', path: '/a/*', requiresAuth: true },
      ],
    ];
    const requests = ['/a/b', '/a/1', '/a/x/y', '/a/x', '/a/B', '/a/b/', '/a', '/%61/b', '/a/%62'];
    const methods = ['GET', 'HEAD', 'POST'];

    for (const routes of tables) {
      const config = toConfig(routes);
      for (const rawPath of requests) {
        for (const method of methods) {
          const { index, honoPath } = await dispatch(routes, rawPath, method);
          const dispatched = routes[index];
          // findMatchingCustomRoute takes Hono's path form and must pick the same route.
          expect(findMatchingCustomRoute(honoPath, method, routes as any)?.route ?? undefined).toBe(dispatched);
          for (const path of [rawPath, honoPath]) {
            const label = `${method} ${path} in ${JSON.stringify(routes)}`;
            if (!dispatched || dispatched.requiresAuth) {
              expect(isCustomRoutePublic(path, method, config), label).toBe(false);
            }
            if (dispatched?.requiresAuth) {
              expect(isProtectedCustomRoute(path, method, config), label).toBe(true);
            }
            if (!dispatched) {
              expect(isProtectedCustomRoute(path, method, config), label).toBe(false);
            }
          }
        }
      }
    }
  });
});
