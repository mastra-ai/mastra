// @vitest-environment jsdom
import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { KeyboardShortcutsProvider } from '@mastra/playground-ui/keyboard/keyboard-shortcuts-context';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, Outlet, RouterProvider, useLocation } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import { AgentLayout } from '@/domains/agents/agent-layout';
import { emptyPlatforms } from '@/domains/agents/components/__tests__/fixtures/channels';
import { v2Agent } from '@/domains/agents/components/__tests__/fixtures/composer-model-settings';
import { GlobalShortcuts } from '@/domains/navigation/components/global-shortcuts';
import { paths } from '@/lib/app-routing';
import { LinkComponentProvider } from '@/lib/framework';
import { Link } from '@/lib/link';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
const AGENT_ID = 'agent-1';

const LocationProbe = () => {
  const location = useLocation();
  return <div data-testid="location-probe">{location.pathname}</div>;
};

const buildRouter = (initialEntry: string) =>
  createMemoryRouter(
    [
      {
        element: (
          <KeyboardShortcutsProvider>
            <GlobalShortcuts />
            <LocationProbe />
            <Outlet />
          </KeyboardShortcutsProvider>
        ),
        children: [
          { path: '/agents', element: <div data-testid="agents-list" /> },
          { path: '/traces', element: <div data-testid="global-traces" /> },
          {
            path: '/agents/:agentId',
            element: (
              <AgentLayout>
                <Outlet />
              </AgentLayout>
            ),
            children: [
              { path: 'threads/new', element: <div data-testid="agent-chat" /> },
              { path: 'traces', element: <div data-testid="agent-traces" /> },
            ],
          },
        ],
      },
    ],
    { initialEntries: [initialEntry] },
  );

const renderAt = (initialEntry: string) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = buildRouter(initialEntry);

  render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <LinkComponentProvider Link={Link} navigate={to => void router.navigate(to)} paths={paths}>
          <TooltipProvider>
            <RouterProvider router={router} />
          </TooltipProvider>
        </LinkComponentProvider>
      </QueryClientProvider>
    </MastraReactProvider>,
  );
};

const installHandlers = () => {
  server.use(
    http.get(`${BASE_URL}/api/agents/${AGENT_ID}`, () => HttpResponse.json(v2Agent)),
    http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json({ enabled: false })),
    http.get(`${BASE_URL}/api/system/packages`, () => HttpResponse.json({ packages: [] })),
    http.get(`${BASE_URL}/api/editor/builder/settings`, () => HttpResponse.json({})),
    http.get(`${BASE_URL}/api/channels/platforms`, () => HttpResponse.json(emptyPlatforms)),
  );
};

const pressGThenT = () => {
  fireEvent.keyDown(window, { key: 'g' });
  fireEvent.keyDown(window, { key: 't' });
};

const locationIs = (pathname: string) =>
  waitFor(() => expect(screen.getByTestId('location-probe').textContent).toBe(pathname));

afterEach(() => {
  cleanup();
});

describe('agent keyboard shortcuts', () => {
  describe('when on /agents (outside any agent page)', () => {
    it('g then t navigates to the global traces page', async () => {
      installHandlers();
      renderAt('/agents');
      await screen.findByTestId('agents-list');

      pressGThenT();

      await locationIs('/traces');
    });
  });

  describe('when on /agents/:agentId/threads/new', () => {
    it('g then t navigates to that agent traces page instead of the global one', async () => {
      installHandlers();
      renderAt(`/agents/${AGENT_ID}/threads/new`);
      await screen.findByTestId('agent-chat');

      pressGThenT();

      await locationIs(`/agents/${AGENT_ID}/traces`);
    });
  });

  describe('when leaving the agent page for /agents', () => {
    it('g then t goes back to the global traces page', async () => {
      installHandlers();
      renderAt(`/agents/${AGENT_ID}/threads/new`);
      await screen.findByTestId('agent-chat');

      fireEvent.keyDown(window, { key: 'g' });
      fireEvent.keyDown(window, { key: 'a' });
      await locationIs('/agents');
      await screen.findByTestId('agents-list');

      pressGThenT();

      await locationIs('/traces');
    });
  });
});
