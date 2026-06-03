// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { MemoryRouter, Routes, Route } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Tests the defensive loading behavior of RoutePermissionGuard:
 * while the authoritative permission patterns (or the user's permissions) are
 * still loading, the guard must NOT leak the protected children. It shows a
 * spinner until both are resolved, then applies normal gating.
 */

const { getPermissionPatterns, permissionsState } = vi.hoisted(() => ({
  getPermissionPatterns: vi.fn<() => Promise<{ patterns: string[] }>>(),
  permissionsState: {
    hasPermission: (_p: string) => true,
    hasAnyPermission: (_p: string[]) => true,
    rbacEnabled: true,
    isAuthenticated: true,
    isLoading: false,
  },
}));

vi.mock('@mastra/react', () => ({
  useMastraClient: () => ({ getPermissionPatterns }),
}));

vi.mock('../hooks/use-permissions', () => ({
  usePermissions: () => permissionsState,
}));

vi.mock('@mastra/playground-ui', () => ({
  Spinner: () => <div data-testid="route-guard-spinner" />,
}));

import { RoutePermissionGuard } from '../route-permission-guard';

function renderGuard(initialPath = '/agents') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  const Wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="*" element={children} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );

  return render(
    <Wrapper>
      <RoutePermissionGuard>
        <div data-testid="protected-content">secret</div>
      </RoutePermissionGuard>
    </Wrapper>,
  );
}

describe('RoutePermissionGuard', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('shows a spinner (not the protected children) while permission patterns load', async () => {
    // Never resolves — keeps the patterns query in the loading state.
    getPermissionPatterns.mockImplementation(() => new Promise(() => {}));

    renderGuard('/agents');

    expect(screen.getByTestId('route-guard-spinner')).toBeTruthy();
    expect(screen.queryByTestId('protected-content')).toBeNull();
  });

  it('renders the protected children once patterns load and the user has access', async () => {
    // Full set of literals the route table ships, so the runtime validator
    // emits no "unknown pattern" warnings for this happy-path fixture.
    getPermissionPatterns.mockResolvedValue({
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
    });

    renderGuard('/agents');

    await waitFor(() => {
      expect(screen.getByTestId('protected-content')).toBeTruthy();
    });
    expect(screen.queryByTestId('route-guard-spinner')).toBeNull();
  });
});
