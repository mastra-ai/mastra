import { LinkComponentProvider } from '@mastra/playground-ui/lib/framework';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AgentConfiguration } from '../agent-configuration';
import { AgentOverview } from '../agent-overview';
import { AgentResourcePage } from '../agent-resource-page';
import { semanticRecallConfig } from '../memory-sidebar/__tests__/fixtures/memory';
import { workspacePackages } from './fixtures/agent-workspace';
import { emptyPlatforms } from './fixtures/channels';
import { paths } from '@/lib/app-routing';
import { Link } from '@/lib/link';
import { agentsListWithSubagent, agentsListWithWorkflow } from '@/pages/agents/__tests__/fixtures/agents';
import { draftAuthDisabled } from '@/pages/agents/agent/__tests__/fixtures/drafts';
import { aggregate, supportedStorage, unsupportedStorage } from '@/pages/metrics/__tests__/fixtures/metrics';
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
    http.get(`${TEST_BASE_URL}/api/auth/capabilities`, () => HttpResponse.json(draftAuthDisabled)),
    http.get(`${TEST_BASE_URL}/api/observability/capabilities`, () => HttpResponse.json(supportedStorage)),
    http.post(`${TEST_BASE_URL}/api/observability/metrics/aggregate`, () => HttpResponse.json(aggregate)),
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
          { path: '/agents/:agentId/configuration', element: <AgentConfiguration /> },
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
      await waitFor(() => expect(router.state.location.pathname).toBe('/agents/researcher/configuration'));
      expect(router.state.location.search).toBe('?tool=search');
      expect(router.state.location.hash).toBe('#tools');
    });
  });
  describe('when opening the agent overview', () => {
    it('summarizes named capabilities and keeps detailed configuration in its own workspace view', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}/api/agents/researcher`, () => HttpResponse.json(agentsListWithSubagent.researcher)),
      );
      const router = createMemoryRouter(
        [
          { path: '/agents/:agentId/overview', element: <AgentOverview /> },
          { path: '/agents/:agentId/configuration', element: <AgentConfiguration /> },
          { path: '/agents/:agentId/metrics', element: <Destination /> },
        ],
        { initialEntries: ['/agents/researcher/overview'] },
      );
      renderWithProviders(
        <LinkComponentProvider Link={Link} paths={paths} navigate={to => void router.navigate(to)}>
          <RouterProvider router={router} />
        </LinkComponentProvider>,
      );
      expect(await screen.findByText('gpt-4o-mini')).toBeTruthy();
      expect(screen.getByRole('link', { name: /search Search the web/ }).getAttribute('href')).toBe(
        '/agents/researcher/configuration?tool=search#tools',
      );
      expect(screen.getByRole('link', { name: /Analysis Agent/ }).getAttribute('href')).toBe(
        '/agents/analyst/overview',
      );
      expect(screen.queryByRole('navigation', { name: 'Configuration sections' })).toBeNull();
      fireEvent.click(screen.getByRole('link', { name: 'Configuration', exact: true }));
      expect(await screen.findByRole('navigation', { name: 'Configuration sections' })).toBeTruthy();
    });
  });
  describe('when activity data is available', () => {
    it('loads real metrics using the active agent scope', async () => {
      const requests: unknown[] = [];
      server.use(
        http.get(`${TEST_BASE_URL}/api/agents/researcher`, () => HttpResponse.json(agentsListWithSubagent.researcher)),
        http.post(`${TEST_BASE_URL}/api/observability/metrics/aggregate`, async ({ request }) => {
          requests.push(await request.json());
          return HttpResponse.json({ ...aggregate, value: 23 });
        }),
      );
      const router = createMemoryRouter([{ path: '/agents/:agentId/overview', element: <AgentOverview /> }], {
        initialEntries: ['/agents/researcher/overview'],
      });
      renderWithProviders(
        <LinkComponentProvider Link={Link} paths={paths} navigate={to => void router.navigate(to)}>
          <RouterProvider router={router} />
        </LinkComponentProvider>,
      );
      await screen.findAllByText('23');
      expect(requests.length).toBeGreaterThan(0);
      for (const request of requests)
        expect(request).toMatchObject({ filters: { rootEntityType: 'agent', entityName: 'Research Agent' } });
    });
  });
  describe('when activity storage does not support metrics', () => {
    it('explains the unavailable summary without requesting metrics', async () => {
      const requests: unknown[] = [];
      server.use(
        http.get(`${TEST_BASE_URL}/api/agents/researcher`, () => HttpResponse.json(agentsListWithSubagent.researcher)),
        http.get(`${TEST_BASE_URL}/api/observability/capabilities`, () => HttpResponse.json(unsupportedStorage)),
        http.post(`${TEST_BASE_URL}/api/observability/metrics/aggregate`, async ({ request }) => {
          requests.push(await request.json());
          return HttpResponse.json(aggregate);
        }),
      );
      const router = createMemoryRouter([{ path: '/agents/:agentId/overview', element: <AgentOverview /> }], {
        initialEntries: ['/agents/researcher/overview'],
      });
      renderWithProviders(
        <LinkComponentProvider Link={Link} paths={paths} navigate={to => void router.navigate(to)}>
          <RouterProvider router={router} />
        </LinkComponentProvider>,
      );
      expect(await screen.findByText('Activity metrics are not available with this storage.')).toBeTruthy();
      expect(requests).toEqual([]);
    });
  });
  describe('when opening a legacy overview configuration bookmark', () => {
    it('preserves the inspection query and navigates to the corresponding configuration section', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}/api/agents/researcher`, () => HttpResponse.json(agentsListWithWorkflow.researcher)),
      );
      const router = createMemoryRouter(
        [
          { path: '/agents/:agentId/overview', element: <AgentOverview /> },
          { path: '/agents/:agentId/configuration', element: <AgentConfiguration /> },
        ],
        { initialEntries: ['/agents/researcher/overview?tool=search#tools'] },
      );
      renderWithProviders(
        <LinkComponentProvider Link={Link} paths={paths} navigate={to => void router.navigate(to)}>
          <RouterProvider router={router} />
        </LinkComponentProvider>,
      );
      await waitFor(() => expect(router.state.location.pathname).toBe('/agents/researcher/configuration'));
      expect(router.state.location.search).toBe('?tool=search');
      expect(router.state.location.hash).toBe('#tools');
      expect(await screen.findByRole('link', { name: 'Inspect and test search' })).toBeTruthy();
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
          { path: '/agents/:agentId/configuration', element: <AgentConfiguration /> },
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
