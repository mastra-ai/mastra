// @vitest-environment jsdom

import { render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router';
import type { RouteObject } from 'react-router';
import { describe, expect, it } from 'vitest';
import { RouteHeader } from '../route-header';
import { RouteHeaderActions, RouteHeaderActionsProvider, RouteHeaderActionsSlot } from '../route-header-actions';
import { RouteHeaderCrumbs, RouteHeaderCrumbsProvider } from '../route-header-crumbs';
import { getRouteHeaderHeading } from '../route-heading';
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
  if (!crumb.id) return false;
  if ('label' in crumb) return crumb.label !== '';
  if ('node' in crumb) return crumb.node !== null && crumb.node !== undefined && crumb.node !== '';
  return Boolean(crumb.Component);
}

function RouteHeaderProbe() {
  const { docs } = useRouteHeader();
  return <div data-testid="route-docs">{docs?.href ?? 'none'}</div>;
}

function RouteHeaderOverrideProbe() {
  return <RouteHeaderCrumbs crumbs={[{ id: 'override', label: 'Override crumb' }]} />;
}

describe('route header handles', () => {
  it('every page under RootLayout inherits or declares breadcrumb data', () => {
    // Scope: only routes nested in the main RootLayout subtree are covered.
    // MinimalRootLayout pages (e.g. /agents/:agentId/session) and unauthenticated
    // pages (/login, /signup) intentionally do not render <RouteHeader/> and are
    // excluded. A child route is considered "covered" when its parent provides
    // crumbs — the test does not require leaf routes to append their own leaf.
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

  it('resolves declared breadcrumb handles to accessible page headings', () => {
    const invalidHandles = collectRouteHandles(getAppRoutes()).flatMap(({ path, handle }) => {
      const crumbs = resolveCrumbs(path, handle);
      const hasUntitledComponentCrumb = crumbs.some(crumb => 'Component' in crumb && !crumb.heading?.trim());
      if (hasUntitledComponentCrumb || !getRouteHeaderHeading(crumbs)) {
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
      expect(crumbs.at(-1)).toMatchObject({ label: '%E0%A4%A' });
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
              handle: { crumbs: [{ id: 'child', label: 'Child' }], docs: () => undefined },
            },
          ],
        },
      ],
      { initialEntries: ['/child'] },
    );

    render(<RouterProvider router={router} />);

    await waitFor(() => expect(screen.getByTestId('route-docs').textContent).toBe('none'));
  });

  it('renders only the active route header action owner', async () => {
    render(
      <RouteHeaderActionsProvider>
        <RouteHeaderActionsSlot />
        <RouteHeaderActions owner="parent">Parent action</RouteHeaderActions>
        <RouteHeaderActions owner="child" priority={1}>
          Child action
        </RouteHeaderActions>
      </RouteHeaderActionsProvider>,
    );

    await waitFor(() => expect(screen.queryByText('Parent action')).toBeNull());
    expect(screen.getByText('Child action')).toBeTruthy();
  });

  it('lets page-level crumbs override route-handle crumbs', async () => {
    const router = createMemoryRouter(
      [
        {
          path: '/',
          element: (
            <RouteHeaderCrumbsProvider>
              <RouteHeader />
              <Outlet />
            </RouteHeaderCrumbsProvider>
          ),
          children: [
            {
              path: 'child',
              element: <RouteHeaderOverrideProbe />,
              handle: { crumbs: [{ id: 'handle', label: 'Handle crumb' }] },
            },
          ],
        },
      ],
      { initialEntries: ['/child'] },
    );

    render(<RouterProvider router={router} />);

    await waitFor(() => expect(screen.getByText('Override crumb')).toBeTruthy());
    expect(screen.queryByText('Handle crumb')).toBeNull();
  });
});
