// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AgentBuilderRootLayout } from '../../layout/agent-builder-root-layout';

const mockUseAuthCapabilities = vi.fn();
const mockUseBuilderAgentAccess = vi.fn();

vi.mock('@/domains/auth/hooks/use-auth-capabilities', () => ({
  useAuthCapabilities: () => mockUseAuthCapabilities(),
}));

vi.mock('../../hooks/use-builder-agent-access', () => ({
  useBuilderAgentAccess: () => mockUseBuilderAgentAccess(),
}));

vi.mock('@/lib/link', () => ({
  Link: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{children}</a>,
}));

function renderAgentBuilderRoute(initialEntry: string) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  const router = createMemoryRouter(
    [
      {
        path: '/login',
        element: <div>Login page</div>,
      },
      {
        path: '/agent-builder',
        element: <AgentBuilderRootLayout paths={{ agentsLink: () => '/agents' }} />,
        children: [
          {
            path: 'agents',
            element: <div>Agent builder home</div>,
          },
          {
            path: 'agents/create',
            element: <div>Create agent</div>,
          },
        ],
      },
    ],
    {
      initialEntries: [initialEntry],
    },
  );

  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );

  return router;
}

describe('AgentBuilderRootLayout', () => {
  beforeEach(() => {
    mockUseAuthCapabilities.mockReset();
    mockUseBuilderAgentAccess.mockReset();

    mockUseBuilderAgentAccess.mockReturnValue({
      isLoading: false,
      denialReason: null,
      hasAgentFeature: true,
    });
  });

  it('redirects unauthenticated users to login with the requested agent-builder route', async () => {
    mockUseAuthCapabilities.mockReturnValue({
      data: { enabled: true, login: { enabled: true } },
      isLoading: false,
    });

    const router = renderAgentBuilderRoute('/agent-builder/agents/create?draft=1#details');

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/login');
    });

    expect(router.state.location.search).toBe('?redirect=%2Fagent-builder%2Fagents%2Fcreate%3Fdraft%3D1%23details');
    expect(screen.getByText('Login page')).toBeTruthy();
  });

  it('renders agent-builder children for authenticated users with access', async () => {
    mockUseAuthCapabilities.mockReturnValue({
      data: {
        enabled: true,
        login: { enabled: true },
        user: { id: 'user-1' },
      },
      isLoading: false,
    });

    renderAgentBuilderRoute('/agent-builder/agents/create');

    expect(await screen.findByText('Create agent')).toBeTruthy();
  });

  it('does not redirect when auth is disabled', async () => {
    mockUseAuthCapabilities.mockReturnValue({
      data: { enabled: false, login: { enabled: true } },
      isLoading: false,
    });

    renderAgentBuilderRoute('/agent-builder/agents');

    expect(await screen.findByText('Agent builder home')).toBeTruthy();
  });
});
