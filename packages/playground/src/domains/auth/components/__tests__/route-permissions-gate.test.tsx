import type { PermissionPatternsResponse } from '@mastra/client-js';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Component } from 'react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Tests RoutePermissionsGate against the real auth + permission-patterns stack
 * (real hooks, real React Query, MSW for the network) per the playground MSW
 * testing strategy. Nothing about our own hooks/gating is mocked.
 *
 * The gate is the single fetch-spinner-validate-or-throw boundary that replaces
 * the old static `P()` validator:
 * - while patterns load, it shows a spinner and never renders children;
 * - once loaded with a complete pattern set, it renders children;
 * - when RBAC is off it renders children without ever requesting patterns;
 * - if a route literal isn't in the server's pattern set, it throws (surfacing
 *   via the app error boundary).
 */

const BASE_URL = 'http://localhost:4111';

vi.mock('@mastra/playground-ui', () => ({
  Spinner: () => <div data-testid="gate-spinner" />,
}));

import { RoutePermissionsGate } from '../route-permissions-gate';
import type { AuthCapabilities } from '@/domains/auth/types';
import { server } from '@/test/msw-server';

const authHandler = (capabilities: AuthCapabilities) =>
  http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json(capabilities));

const patternsHandler = (response: PermissionPatternsResponse, opts?: { gate?: Promise<void> }) =>
  http.get(`${BASE_URL}/api/auth/permission-patterns`, async () => {
    // When gated, stay pending until the test releases the gate. The gate is
    // always resolved in afterEach so we never leak a forever-pending fetch
    // into later test files (which would clobber global fetch/MSW state).
    if (opts?.gate) await opts.gate;
    return HttpResponse.json(response);
  });

// The full literal set the route table ships, so the gate's validation passes.
const allPatterns: PermissionPatternsResponse = {
  patterns: [
    'agents:read',
    'workflows:read',
    'observability:read',
    'logs:read',
    'scores:read',
    'datasets:read',
    'tools:read',
    'mcp:read',
    'processors:read',
    'stored-prompt-blocks:read',
    'workspaces:read',
    '*',
  ],
};

// A deliberately incomplete pattern set: missing every literal the route table
// references, so the gate's validation must throw.
const incompletePatterns: PermissionPatternsResponse = {
  patterns: ['something:else'],
};

// An authenticated, RBAC-enabled admin.
const rbacCapabilities: AuthCapabilities = {
  enabled: true,
  login: { type: 'credentials' },
  user: { id: 'admin-1', email: 'admin@example.com' },
  capabilities: { user: true, session: true, sso: false, rbac: true, acl: false },
  access: { roles: ['admin'], permissions: ['*'] },
};

// Auth enabled but RBAC disabled: the gate should never fetch patterns.
const rbacDisabledCapabilities: AuthCapabilities = {
  enabled: true,
  login: { type: 'credentials' },
  user: { id: 'user-1', email: 'user@example.com' },
  capabilities: { user: true, session: true, sso: false, rbac: false, acl: false },
  access: { roles: [], permissions: [] },
};

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return <div data-testid="boundary">{this.state.error.message}</div>;
    }
    return this.props.children;
  }
}

function renderGate() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <ErrorBoundary>
          <RoutePermissionsGate>
            <div data-testid="app-content">app</div>
          </RoutePermissionsGate>
        </ErrorBoundary>
      </QueryClientProvider>
    </MastraReactProvider>,
  );
}

describe('RoutePermissionsGate', () => {
  let releaseGate: () => void = () => {};

  afterEach(() => {
    // Always settle any pending patterns request so it never leaks past the
    // test and races with global fetch/MSW state in later test files.
    releaseGate();
    releaseGate = () => {};
    cleanup();
    vi.clearAllMocks();
  });

  it('shows a spinner (not the children) while permission patterns load', async () => {
    const gate = new Promise<void>(resolve => {
      releaseGate = resolve;
    });
    server.use(authHandler(rbacCapabilities), patternsHandler(allPatterns, { gate }));

    renderGate();

    expect(await screen.findByTestId('gate-spinner')).toBeTruthy();
    expect(screen.queryByTestId('app-content')).toBeNull();
  });

  it('renders the children once patterns resolve with a complete set', async () => {
    server.use(authHandler(rbacCapabilities), patternsHandler(allPatterns));

    renderGate();

    expect(await screen.findByTestId('app-content')).toBeTruthy();
    expect(screen.queryByTestId('gate-spinner')).toBeNull();
    expect(screen.queryByTestId('boundary')).toBeNull();
  });

  it('renders the children without requesting patterns when RBAC is off', async () => {
    const onPatterns = vi.fn<() => void>();
    server.use(
      authHandler(rbacDisabledCapabilities),
      http.get(`${BASE_URL}/api/auth/permission-patterns`, () => {
        onPatterns();
        return HttpResponse.json(allPatterns);
      }),
    );

    renderGate();

    expect(await screen.findByTestId('app-content')).toBeTruthy();
    // Give any stray query a chance to fire before asserting it didn't.
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(onPatterns).not.toHaveBeenCalled();
  });

  it('throws (surfacing via the error boundary) on an invalid route literal', async () => {
    server.use(authHandler(rbacCapabilities), patternsHandler(incompletePatterns));

    renderGate();

    const boundary = await screen.findByTestId('boundary');
    expect(boundary.textContent).toContain('Invalid permission pattern');
    expect(screen.queryByTestId('app-content')).toBeNull();
  });
});
