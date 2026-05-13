// @vitest-environment jsdom

import { render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router';
import type { RouteObject } from 'react-router';
import { describe, expect, it } from 'vitest';
import type { CrumbDef, RouteHeaderHandle } from '../types';
import { useRouteHeader } from '../use-route-header';
import { routes } from '@/App';

function getAppRoutes() {
  const rootRoute = routes.find(route => route.children?.some(child => child.path === '/agents'));
  if (!rootRoute?.children) {
    throw new Error('Could not find the main app route tree.');
  }

  return rootRoute.children;
}

function joinPath(basePath: string, route: RouteObject) {
  if (route.index) return basePath || '/';
  if (!route.path) return basePath;
  if (route.path.startsWith('/')) return route.path;

  const normalizedBase = basePath === '/' ? '' : basePath.replace(/\/$/, '');
  return `${normalizedBase}/${route.path}`.replace(/\/+/g, '/');
}

function getHandle(route: RouteObject) {
  return route.handle as RouteHeaderHandle | undefined;
}

function hasRouteCrumbs(route: RouteObject) {
  return Boolean(getHandle(route)?.crumbs);
}

function isRoutableAppPage(route: RouteObject) {
  return Boolean(route.element && (route.path || route.index));
}

function collectRoutesMissingCrumbs(routesToCheck: RouteObject[], basePath = '', hasParentCrumbs = false) {
  const missingRoutes: string[] = [];

  for (const route of routesToCheck) {
    const routePath = joinPath(basePath, route);
    const hasCrumbs = hasParentCrumbs || hasRouteCrumbs(route);

    if (isRoutableAppPage(route) && !hasCrumbs) {
      missingRoutes.push(routePath);
    }

    if (route.children) {
      missingRoutes.push(...collectRoutesMissingCrumbs(route.children, routePath, hasCrumbs));
    }
  }

  return missingRoutes;
}

function sampleParamsForRoute(path: string) {
  const params: Record<string, string> = {};

  for (const match of path.matchAll(/:([A-Za-z0-9_]+)/g)) {
    const paramName = match[1];
    params[paramName] = `${paramName}-fixture`;
  }

  return params;
}

function resolveCrumbs(routePath: string, handle: RouteHeaderHandle): CrumbDef[] {
  if (!handle.crumbs) return [];
  if (typeof handle.crumbs === 'function') {
    return handle.crumbs({
      params: sampleParamsForRoute(routePath),
      pathname: routePath.replace(/:([A-Za-z0-9_]+)/g, '$1-fixture'),
    });
  }

  return handle.crumbs;
}

function collectRouteHandles(routesToCheck: RouteObject[], basePath = '') {
  const handles: Array<{ path: string; handle: RouteHeaderHandle }> = [];

  for (const route of routesToCheck) {
    const routePath = joinPath(basePath, route);
    const handle = getHandle(route);

    if (handle) {
      handles.push({ path: routePath, handle });
    }

    if (route.children) {
      handles.push(...collectRouteHandles(route.children, routePath));
    }
  }

  return handles;
}

function hasRenderableNode(crumb: CrumbDef) {
  return crumb.node !== null && crumb.node !== undefined && crumb.node !== '';
}

function RouteHeaderProbe() {
  const { docs } = useRouteHeader();
  return <div data-testid="route-docs">{docs?.href ?? 'none'}</div>;
}

describe('route header handles', () => {
  it('gives every main app page breadcrumb data', () => {
    expect(collectRoutesMissingCrumbs(getAppRoutes())).toEqual([]);
  });

  it('resolves declared breadcrumb handles to non-empty crumbs', () => {
    const invalidHandles = collectRouteHandles(getAppRoutes()).flatMap(({ path, handle }) => {
      const crumbs = resolveCrumbs(path, handle);
      if (crumbs.length === 0 || crumbs.some(crumb => !hasRenderableNode(crumb))) {
        return [path];
      }

      return [];
    });

    expect(invalidHandles).toEqual([]);
  });

  it('does not throw when route params contain malformed URI encoding', () => {
    const scheduleHandle = collectRouteHandles(getAppRoutes()).find(
      ({ path }) => path === '/workflows/schedules/:scheduleId',
    )?.handle;

    expect(scheduleHandle?.crumbs).toBeTypeOf('function');
    expect(() => {
      if (typeof scheduleHandle?.crumbs !== 'function') return;
      const crumbs = scheduleHandle.crumbs({
        params: { scheduleId: '%E0%A4%A' },
        pathname: '/workflows/schedules/%E0%A4%A',
      });
      expect(crumbs.at(-1)?.node).toBe('%E0%A4%A');
    }).not.toThrow();
  });

  it('allows deeper route handles to clear inherited docs links', async () => {
    const router = createMemoryRouter(
      [
        {
          path: '/',
          element: <Outlet />,
          handle: { docs: { href: 'https://example.com/docs' } },
          children: [
            {
              path: 'child',
              element: <RouteHeaderProbe />,
              handle: { docs: () => undefined },
            },
          ],
        },
      ],
      { initialEntries: ['/child'] },
    );

    render(<RouterProvider router={router} />);

    await waitFor(() => expect(screen.getByTestId('route-docs').textContent).toBe('none'));
  });
});
