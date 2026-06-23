import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type * as ReactRouter from 'react-router';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Tests RoutePermissionGuard against the real auth stack (real hooks, real
 * React Query, MSW for the network) per the playground MSW testing strategy.
 * The only seam we mock is react-router's <Navigate>, so we can assert the
 * redirect target without driving an actual history change.
 *
 * The guard no longer fetches permission patterns — that is handled once by
 * RoutePermissionsGate higher in the tree. So the guard's only async dependency
 * is the user's own permissions (GET /auth/capabilities).
 *
 * Behavior under test:
 * - While the user's permissions are still loading, the guard shows a spinner
 *   and never leaks the protected children.
 * - Once resolved, it applies normal gating: allows accessible routes,
 *   redirects denied routes to the first accessible route, and avoids an
 *   infinite redirect loop when the fallback is the current page.
 */

const BASE_URL = 'http://localhost:4111';

// Mock only <Navigate> so we can observe the redirect target directly. This is
// an explicitly acceptable seam (asserting redirect destination) and keeps the
// auth/permission gating logic itself fully real.
const navigateSpy = vi.fn<(to: string) => void>();
vi.mock('react-router', async importOriginal => {
  const actual = await importOriginal<typeof ReactRouter>();
  return {
    ...actual,
    Navigate: ({ to }: { to: string }) => {
      navigateSpy(to);
      return <div data-testid="navigate" data-to={to} />;
    },
  };
});

vi.mock('@mastra/playground-ui', () => ({
  Spinner: () => <div data-testid="route-guard-spinner" />,
}));

import { RoutePermissionGuard } from '../route-permission-guard';
import type { AuthCapabilities } from '@/domains/auth/types';
import { server } from '@/test/msw-server';

const authHandler = (capabilities: AuthCapabilities, opts?: { hang?: boolean }) =>
  http.get(`${BASE_URL}/api/auth/capabilities`, async () => {
    if (opts?.hang) await new Promise(() => {});
    return HttpResponse.json(capabilities);
  });

// An authenticated, RBAC-enabled admin (has every permission via '*').
const adminCapabilities: AuthCapabilities = {
  enabled: true,
  login: { type: 'credentials' },
  user: { id: 'admin-1', email: 'admin@example.com' },
  capabilities: { user: true, session: true, sso: false, rbac: true, acl: false },
  access: { roles: ['admin'], permissions: ['*'] },
};

// An authenticated, RBAC-enabled user that can only read agents.
const agentsOnlyCapabilities: AuthCapabilities = {
  enabled: true,
  login: { type: 'credentials' },
  user: { id: 'user-1', email: 'user@example.com' },
  capabilities: { user: true, session: true, sso: false, rbac: true, acl: false },
  access: { roles: ['member'], permissions: ['agents:read'] },
};

// An authenticated, RBAC-enabled user with no gated-route permissions at all.
const noAccessCapabilities: AuthCapabilities = {
  enabled: true,
  login: { type: 'credentials' },
  user: { id: 'user-2', email: 'none@example.com' },
  capabilities: { user: true, session: true, sso: false, rbac: true, acl: false },
  access: { roles: ['guest'], permissions: [] },
};

function LocationProbe() {
  const { pathname } = useLocation();
  return <div data-testid="pathname">{pathname}</div>;
}

function renderGuard(initialPath: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[initialPath]}>
          <LocationProbe />
          <Routes>
            <Route
              path="*"
              element={
                <RoutePermissionGuard>
                  <div data-testid="protected-content">secret</div>
                </RoutePermissionGuard>
              }
            />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </MastraReactProvider>,
  );
}

describe('RoutePermissionGuard', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('shows a spinner (not the protected children) while the user permissions load', async () => {
    server.use(authHandler(adminCapabilities, { hang: true }));

    renderGuard('/agents');

    // The capabilities request hangs, so the guard stays in its loading branch
    // and never leaks the children.
    expect(await screen.findByTestId('route-guard-spinner')).toBeTruthy();
    expect(screen.queryByTestId('protected-content')).toBeNull();
  });

  it('renders the protected children once permissions load and the user has access', async () => {
    server.use(authHandler(adminCapabilities));

    renderGuard('/agents');

    expect(await screen.findByTestId('protected-content')).toBeTruthy();
    expect(screen.queryByTestId('route-guard-spinner')).toBeNull();
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('redirects a denied user to their first accessible route', async () => {
    // User can only read agents but lands on /workflows, which they cannot
    // access. The guard must redirect to /agents (their first accessible route)
    // instead of leaking the denied route's children.
    server.use(authHandler(agentsOnlyCapabilities));

    renderGuard('/workflows');

    await waitFor(() => {
      expect(navigateSpy).toHaveBeenCalledWith('/agents');
    });
    expect(screen.queryByTestId('protected-content')).toBeNull();
  });

  it('does not redirect (no loop) when the fallback route is the page already shown', async () => {
    // A user with no accessible gated routes: getFirstAccessibleRoute falls
    // back to /resources (a public page). When already on /resources, the guard
    // renders children instead of navigating to itself (which would loop).
    server.use(authHandler(noAccessCapabilities));

    renderGuard('/resources');

    expect(await screen.findByTestId('protected-content')).toBeTruthy();
    expect(navigateSpy).not.toHaveBeenCalled();
    expect(screen.getByTestId('pathname').textContent).toBe('/resources');
  });
});
