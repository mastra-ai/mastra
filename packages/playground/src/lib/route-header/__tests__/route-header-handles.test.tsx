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
import { ExperimentCrumb } from '@/domains/experiments/experiment-crumb';

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

  it('experiment item route yields Experiments / {expId} / Items / {itemId} with a non-clickable Items crumb', () => {
    const handles = collectRouteHandles(getAppRoutes());
    const parentHandle = handles.find(({ path }) => path === '/experiments/:experimentId')?.handle;
    const childHandle = handles.find(({ path }) => path === '/experiments/:experimentId/items/:itemId')?.handle;

    expect(parentHandle?.crumbs).toBeTypeOf('function');
    expect(childHandle?.crumbs).toBeTypeOf('function');
    if (typeof parentHandle?.crumbs !== 'function' || typeof childHandle?.crumbs !== 'function') return;

    const ctx = {
      params: { experimentId: 'exp-1', itemId: 'item-1' },
      pathname: '/experiments/exp-1/items/item-1',
    };
    // Parent crumbs come first, child crumbs append (see useRouteHeader).
    const crumbs = [...parentHandle.crumbs(ctx), ...childHandle.crumbs(ctx)];

    expect(crumbs.map(c => c.id)).toEqual(['nav:/experiments', 'experiment', 'experiment-items', 'experiment-item']);
    // The experiment crumb is hook-driven (name with id fallback) but stays linkable.
    expect(crumbs[1]).toMatchObject({ Component: ExperimentCrumb, to: '/experiments/exp-1' });
    expect(crumbs[2]).toMatchObject({ label: 'Items' });
    expect(crumbs[2].to).toBeUndefined();
    expect(crumbs[3]).toMatchObject({ label: 'item-1' });
  });

  it('review queue route yields Experiments / Review Queue with a linkable Experiments crumb', () => {
    const handles = collectRouteHandles(getAppRoutes());
    const handle = handles.find(({ path }) => path === '/experiments/review-queue')?.handle;

    expect(handle?.crumbs).toBeTypeOf('function');
    if (typeof handle?.crumbs !== 'function') return;

    const crumbs = handle.crumbs({ params: {}, pathname: '/experiments/review-queue' });

    expect(crumbs.map(c => c.id)).toEqual(['nav:/experiments', 'nav:/experiments/review-queue']);
    expect(crumbs[0]).toMatchObject({ label: 'Experiments', to: '/experiments' });
    expect(crumbs[1]).toMatchObject({ label: 'Review Queue' });
  });

  it('dataset item route yields Datasets / {dataset} / Items / {itemId} with a non-clickable Items crumb', () => {
    const handles = collectRouteHandles(getAppRoutes());
    const parentHandle = handles.find(({ path }) => path === '/datasets/:datasetId')?.handle;
    const childHandle = handles.find(({ path }) => path === '/datasets/:datasetId/items/:itemId')?.handle;

    expect(parentHandle?.crumbs).toBeTypeOf('function');
    expect(childHandle?.crumbs).toBeTypeOf('function');
    if (typeof parentHandle?.crumbs !== 'function' || typeof childHandle?.crumbs !== 'function') return;

    const ctx = {
      params: { datasetId: 'ds-1', itemId: 'item-1' },
      pathname: '/datasets/ds-1/items/item-1',
    };
    // Parent crumbs come first, child crumbs append (see useRouteHeader).
    const crumbs = [...parentHandle.crumbs(ctx), ...childHandle.crumbs(ctx)];

    expect(crumbs.map(c => c.id)).toEqual(['nav:/datasets', 'dataset', 'dataset-items', 'dataset-item']);
    expect(crumbs[1].to).toBe('/datasets/ds-1');
    expect(crumbs[2]).toMatchObject({ label: 'Items' });
    expect(crumbs[2].to).toBeUndefined();
    expect(crumbs[3]).toMatchObject({ label: 'item-1' });
  });

  it('truncates long item ids to 8 chars with an ellipsis in item and compare crumbs', () => {
    const handles = collectRouteHandles(getAppRoutes());
    const itemHandle = handles.find(({ path }) => path === '/datasets/:datasetId/items/:itemId')?.handle;
    const compareHandle = handles.find(
      ({ path }) => path === '/datasets/:datasetId/items/:itemId/compare/:secondItemId',
    )?.handle;

    expect(itemHandle?.crumbs).toBeTypeOf('function');
    expect(compareHandle?.crumbs).toBeTypeOf('function');
    if (typeof itemHandle?.crumbs !== 'function' || typeof compareHandle?.crumbs !== 'function') return;

    const longId = '03bb5c8f-970f-4d09-98cb-e3f0bd5813f0';
    const secondId = '50203836-7083-448d-8624-97eae4dfb297';

    const itemCrumbs = itemHandle.crumbs({
      params: { datasetId: 'ds-1', itemId: longId },
      pathname: `/datasets/ds-1/items/${longId}`,
    });
    expect(itemCrumbs.find(c => c.id === 'dataset-item')).toMatchObject({ label: '03bb5c8f...' });

    const compareCrumbs = compareHandle.crumbs({
      params: { datasetId: 'ds-1', itemId: longId, secondItemId: secondId },
      pathname: `/datasets/ds-1/items/${longId}/compare/${secondId}`,
    });
    // Truncated label, but the link keeps the full id.
    expect(compareCrumbs.find(c => c.id === 'dataset-item')).toMatchObject({
      label: '03bb5c8f...',
      to: `/datasets/ds-1/items/${longId}`,
    });
    expect(compareCrumbs.find(c => c.id === 'dataset-item-compare-second')).toMatchObject({ label: '50203836...' });
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
