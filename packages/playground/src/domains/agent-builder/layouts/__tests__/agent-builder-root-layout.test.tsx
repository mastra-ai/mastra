import type { BuilderSettingsResponse } from '@mastra/client-js';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { AgentBuilderRootLayout } from '../agent-builder-root-layout';
import type { AuthCapabilities } from '@/domains/auth/types';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

const unauthenticatedCapabilities = {
  enabled: true,
  login: { type: 'credentials' as const },
} satisfies AuthCapabilities;

const authenticatedCapabilities = {
  enabled: true,
  login: { type: 'credentials' as const },
  user: { id: 'user-1', email: 'u@example.com' },
  capabilities: { user: true, session: true, sso: false, rbac: false, acl: false },
  access: null,
} satisfies AuthCapabilities;

const authDisabledCapabilities = {
  enabled: false,
  login: { type: 'credentials' as const },
} satisfies AuthCapabilities;

const authenticatedWithoutBuilderAccess = {
  ...authenticatedCapabilities,
  capabilities: { ...authenticatedCapabilities.capabilities, rbac: true },
  access: { roles: [], permissions: [] },
} satisfies AuthCapabilities;

const builderFullySetUp: BuilderSettingsResponse = {
  enabled: true,
  features: {
    agent: {},
  },
};

const builderDisabled: BuilderSettingsResponse = {
  enabled: false,
};

function authHandler(capabilities: AuthCapabilities) {
  return http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json(capabilities));
}

function builderHandler(settings: BuilderSettingsResponse | { error: true }) {
  return http.get(`${BASE_URL}/api/editor/builder/settings`, () => {
    if ('error' in settings && settings.error) {
      return HttpResponse.json({ error: 'boom' }, { status: 500 });
    }
    return HttpResponse.json(settings);
  });
}

function renderAgentBuilderRoute(initialEntry: string, basename?: string) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  const router = createMemoryRouter(
    [
      {
        path: '/login',
        element: <div>Login page</div>,
      },
      {
        path: '/agents',
        element: <div>Agents page</div>,
      },
      {
        path: '/agent-builder',
        element: <AgentBuilderRootLayout paths={{ agentsLink: () => '/agents' } as never} />,
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
      basename,
    },
  );

  render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </MastraReactProvider>,
  );

  return router;
}

afterEach(() => {
  server.resetHandlers();
});

describe('AgentBuilderRootLayout', () => {
  it('redirects unauthenticated users to login with the requested agent-builder route', async () => {
    server.use(authHandler(unauthenticatedCapabilities), builderHandler(builderFullySetUp));

    const router = renderAgentBuilderRoute('/agent-builder/agents/create?draft=1#details');

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/login');
    });

    expect(router.state.location.search).toBe('?redirect=%2Fagent-builder%2Fagents%2Fcreate%3Fdraft%3D1%23details');
    expect(await screen.findByText('Login page')).toBeTruthy();
  });

  describe('when an authenticated user without Agent Builder access uses a nested Studio base path', () => {
    it('navigates back to the Studio agents page within the base path', async () => {
      server.use(authHandler(authenticatedWithoutBuilderAccess));

      const router = renderAgentBuilderRoute('/studio/agent-builder/agents', '/studio');
      fireEvent.click(await screen.findByRole('link', { name: 'Back to Studio' }));

      await waitFor(() => expect(router.state.location.pathname).toBe('/studio/agents'));
      expect(await screen.findByText('Agents page')).toBeTruthy();
    });
  });

  it('renders agent-builder children for authenticated users with access', async () => {
    server.use(authHandler(authenticatedCapabilities), builderHandler(builderFullySetUp));

    renderAgentBuilderRoute('/agent-builder/agents/create');

    expect(await screen.findByText('Create agent')).toBeTruthy();
  });

  it('does not redirect when auth is disabled', async () => {
    server.use(authHandler(authDisabledCapabilities), builderHandler(builderFullySetUp));

    renderAgentBuilderRoute('/agent-builder/agents');

    expect(await screen.findByText('Agent builder home')).toBeTruthy();
  });

  it('shows the not-configured screen when the builder is disabled', async () => {
    server.use(authHandler(authenticatedCapabilities), builderHandler(builderDisabled));

    renderAgentBuilderRoute('/agent-builder/agents');

    expect(await screen.findByText('Agent Builder Not Configured')).toBeTruthy();
  });

  it('shows the error screen when the builder settings fail to load', async () => {
    server.use(authHandler(authenticatedCapabilities), builderHandler({ error: true }));

    renderAgentBuilderRoute('/agent-builder/agents');

    expect(await screen.findByText('Failed to load Agent Builder configuration.')).toBeTruthy();
  });
});
