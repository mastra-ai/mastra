// @vitest-environment jsdom
import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, Outlet, RouterProvider, useLocation } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import { AgentLayout } from '@/domains/agents/agent-layout';
import { emptyPlatforms } from '@/domains/agents/components/__tests__/fixtures/channels';
import { memoryDisabled, v2Agent } from '@/domains/agents/components/__tests__/fixtures/composer-model-settings';
import { semanticRecallConfig } from '@/domains/agents/components/memory-sidebar/__tests__/fixtures/memory';
import { agentIndexLoader, legacyAgentSettingsLoader, paths } from '@/lib/app-routing';
import { LinkComponentProvider } from '@/lib/framework';
import { Link } from '@/lib/link';
import Agent from '@/pages/agents/agent';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
const AGENT_ID = 'agent-1';

const LocationProbe = () => {
  const location = useLocation();
  return <div data-testid="location-probe">{`${location.pathname}${location.search}`}</div>;
};

const buildRouter = (initialEntry: string) =>
  createMemoryRouter(
    [
      {
        element: (
          <>
            <LocationProbe />
            <Outlet />
          </>
        ),
        children: [
          {
            path: '/agents/:agentId',
            element: (
              <AgentLayout>
                <Outlet />
              </AgentLayout>
            ),
            children: [
              { index: true, loader: agentIndexLoader },
              { path: 'overview', element: <Agent /> },
              { path: 'settings', loader: legacyAgentSettingsLoader },
            ],
          },
          { path: '/agents/:agentId/threads/:threadId', element: <div data-testid="thread-route" /> },
        ],
      },
    ],
    { initialEntries: [initialEntry] },
  );

const renderAt = (initialEntry: string) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
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

  return router;
};

function installHandlers() {
  server.use(
    http.get(`${BASE_URL}/api/agents/${AGENT_ID}`, () => HttpResponse.json(v2Agent)),
    http.get(`${BASE_URL}/api/memory/status`, () => HttpResponse.json(memoryDisabled)),
    http.get(`${BASE_URL}/api/memory/config`, () => HttpResponse.json(semanticRecallConfig)),
    http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json({ enabled: false })),
    http.get(`${BASE_URL}/api/system/packages`, () => HttpResponse.json({ packages: [] })),
    http.get(`${BASE_URL}/api/editor/builder/settings`, () => HttpResponse.json({})),
    http.get(`${BASE_URL}/api/scores/scorers`, () => HttpResponse.json({ scorers: [] })),
    http.get(`${BASE_URL}/api/memory/threads/:threadId/working-memory`, () =>
      HttpResponse.json({ workingMemory: null, source: 'thread' }),
    ),
    http.get(`${BASE_URL}/api/channels/platforms`, () => HttpResponse.json(emptyPlatforms)),
  );
}

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe('Agent overview page', () => {
  describe('when visiting bare /agents/:agentId', () => {
    it('redirects to /agents/:agentId/overview', async () => {
      installHandlers();
      renderAt(`/agents/${AGENT_ID}`);

      await waitFor(() =>
        expect(screen.getByTestId('location-probe').textContent).toBe(`/agents/${AGENT_ID}/overview`),
      );
    });
  });

  describe('when visiting /agents/:agentId/overview', () => {
    it('shows the agent settings content', async () => {
      installHandlers();
      renderAt(`/agents/${AGENT_ID}/overview`);

      expect(await screen.findByTestId('agent-settings-view')).not.toBeNull();
    });

    it('shows the Overview tab first and active', async () => {
      installHandlers();
      renderAt(`/agents/${AGENT_ID}/overview`);

      const tabs = await screen.findAllByRole('tab');
      expect(tabs[0].textContent).toContain('Overview');
      await waitFor(() => expect(tabs[0].getAttribute('aria-selected')).toBe('true'));
    });

    it('does not render a Chat tab', async () => {
      installHandlers();
      renderAt(`/agents/${AGENT_ID}/overview`);

      await screen.findAllByRole('tab');
      expect(screen.queryByRole('tab', { name: 'Chat' })).toBeNull();
    });

    it('opens a new chat from the button next to the agent header', async () => {
      installHandlers();
      renderAt(`/agents/${AGENT_ID}/overview`);

      const newChatButton = await screen.findByTestId('agent-view-header-new-chat');
      expect(newChatButton.getAttribute('href')).toBe(`/agents/${AGENT_ID}/threads/new`);

      fireEvent.click(newChatButton);

      await waitFor(() =>
        expect(screen.getByTestId('location-probe').textContent).toBe(`/agents/${AGENT_ID}/threads/new`),
      );
    });
  });

  describe('when visiting the legacy /agents/:agentId/settings URL', () => {
    it('redirects to /overview preserving the tab query', async () => {
      installHandlers();
      renderAt(`/agents/${AGENT_ID}/settings?tab=channels`);

      await waitFor(() =>
        expect(screen.getByTestId('location-probe').textContent).toBe(`/agents/${AGENT_ID}/overview?tab=channels`),
      );
    });
  });

  describe('when building agent links', () => {
    it('points paths.agentLink at the overview page', () => {
      expect(paths.agentLink(AGENT_ID)).toBe(`/agents/${AGENT_ID}/overview`);
    });
  });
});
