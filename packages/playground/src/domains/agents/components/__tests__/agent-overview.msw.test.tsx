import { LinkComponentProvider } from '@mastra/playground-ui/lib/framework';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AgentOverview } from '../agent-overview';
import { AgentResourcePage } from '../agent-resource-page';
import { semanticRecallConfig } from '../memory-sidebar/__tests__/fixtures/memory';
import { workspacePackages } from './fixtures/agent-workspace';
import { emptyPlatforms } from './fixtures/channels';
import { paths } from '@/lib/app-routing';
import { Link } from '@/lib/link';
import { agentsListWithWorkflow } from '@/pages/agents/__tests__/fixtures/agents';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

function Destination() {
  return <output>{useLocation().pathname}</output>;
}

// jsdom has no layout; scrolling is checked against the browser preview.
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});
beforeEach(() => {
  server.use(
    http.get(`${TEST_BASE_URL}/api/system/packages`, () => HttpResponse.json(workspacePackages)),
    http.get(`${TEST_BASE_URL}/api/channels/platforms`, () => HttpResponse.json(emptyPlatforms)),
    http.get(`${TEST_BASE_URL}/api/scores/scorers`, () => HttpResponse.json({ scorers: [] })),
    http.get(`${TEST_BASE_URL}/api/memory/config`, () => HttpResponse.json(semanticRecallConfig)),
  );
});

describe('Agent overview', () => {
  describe('when inspecting configuration and resources', () => {
    it('shows tool details, model and prompt together and preserves legacy tool deep links', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}/api/agents/researcher`, () => HttpResponse.json(agentsListWithWorkflow.researcher)),
        http.get(`${TEST_BASE_URL}/api/system/packages`, () => HttpResponse.json(workspacePackages)),
        http.get(`${TEST_BASE_URL}/api/channels/platforms`, () => HttpResponse.json(emptyPlatforms)),
        http.get(`${TEST_BASE_URL}/api/scores/scorers`, () => HttpResponse.json({ scorers: [] })),
        http.get(`${TEST_BASE_URL}/api/memory/config`, () => HttpResponse.json(semanticRecallConfig)),
      );
      const router = createMemoryRouter(
        [
          { path: '/agents/:agentId/overview', element: <AgentOverview /> },
          { path: '/agents/:agentId/resources/:resource', element: <AgentResourcePage /> },
        ],
        { initialEntries: ['/agents/researcher/resources/tools?tool=search'] },
      );
      renderWithProviders(
        <LinkComponentProvider Link={Link} paths={paths} navigate={to => void router.navigate(to)}>
          <RouterProvider router={router} />
        </LinkComponentProvider>,
      );
      expect(await screen.findByText('Search the web')).toBeTruthy();
      expect(screen.getByText('gpt-4o-mini')).toBeTruthy();
      expect(screen.getByText('Find reliable sources and summarize the evidence.')).toBeTruthy();
      expect(screen.getByRole('link', { name: 'Inspect and test search' }).getAttribute('href')).toContain(
        'tool=search',
      );
      await waitFor(() => expect(router.state.location.pathname).toBe('/agents/researcher/overview'));
      expect(router.state.location.search).toBe('?tool=search');
      expect(router.state.location.hash).toBe('#tools');
    });
  });
  describe('when the agent has attached workflows', () => {
    it('opens the selected workflow from its visual resource card', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}/api/agents/researcher`, () => HttpResponse.json(agentsListWithWorkflow.researcher)),
      );
      const router = createMemoryRouter(
        [
          { path: '/agents/:agentId/overview', element: <AgentOverview /> },
          { path: '/workflows/:workflowId', element: <Destination /> },
        ],
        { initialEntries: ['/agents/researcher/overview'] },
      );
      renderWithProviders(
        <LinkComponentProvider Link={Link} paths={paths} navigate={to => void router.navigate(to)}>
          <RouterProvider router={router} />
        </LinkComponentProvider>,
      );
      fireEvent.click(await screen.findByRole('link', { name: 'Open workflow Summary workflow' }));
      expect(await screen.findByText('/workflows/summarize')).toBeTruthy();
    });
  });
});
