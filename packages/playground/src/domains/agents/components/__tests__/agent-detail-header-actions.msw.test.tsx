import type { GetAgentResponse } from '@mastra/client-js';
import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { LinkComponentProvider } from '@mastra/playground-ui/lib/framework';
import type { CollapsiblePanelHandle } from '@mastra/playground-ui/resize/collapsible-panel';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useImperativeHandle } from 'react';
import { Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AgentDetailHeaderActions } from '../agent-detail-header-actions';
import { v2Agent } from './fixtures/composer-model-settings';
import { buildBuilderSettings } from '@/domains/agent-builder/hooks/__tests__/fixtures/builder-settings';
import { paths } from '@/lib/app-routing';
import { Link } from '@/lib/link';
import { RouteSidePanelProvider, useRouteSidePanel } from '@/lib/route-side-panel';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

const AGENT_ID = 'agent-1';
const storedAgent: GetAgentResponse = { ...v2Agent, source: 'stored' };

function installHandlers(agent: GetAgentResponse = v2Agent, builderEnabled = true) {
  server.use(
    http.get(`${TEST_BASE_URL}/api/agents/${AGENT_ID}`, () => HttpResponse.json(agent)),
    http.get(`${TEST_BASE_URL}/api/auth/capabilities`, () => HttpResponse.json({ enabled: false })),
    http.get(`${TEST_BASE_URL}/api/system/packages`, () => HttpResponse.json({ packages: [] })),
    http.get(`${TEST_BASE_URL}/api/editor/builder/settings`, () =>
      HttpResponse.json(buildBuilderSettings({ enabled: builderEnabled })),
    ),
  );
}

const panelHandle: CollapsiblePanelHandle = { collapse: vi.fn(), expand: vi.fn(), toggle: vi.fn() };

/** Stands in for the layout's CollapsiblePanel: binds the shared handle and lets the test report a size. */
function FakeLayoutPanel() {
  const { panelHandle: ref, onPanelResize } = useRouteSidePanel();
  useImperativeHandle(ref, () => panelHandle);
  return (
    <button type="button" onClick={() => onPanelResize(380)}>
      report-expanded
    </button>
  );
}

function renderActions() {
  return renderWithProviders(
    <LinkComponentProvider Link={Link} navigate={() => {}} paths={paths}>
      <TooltipProvider>
        <RouteSidePanelProvider>
          <FakeLayoutPanel />
          <Routes>
            <Route
              path="/agents/:agentId/threads/new"
              element={
                <div data-testid="header-actions">
                  <AgentDetailHeaderActions agentId={AGENT_ID} />
                </div>
              }
            />
            <Route path="/agent-builder/agents/:id/edit" element={<div>Agent Builder editor</div>} />
          </Routes>
        </RouteSidePanelProvider>
      </TooltipProvider>
    </LinkComponentProvider>,
    { router: { initialEntries: [`/agents/${AGENT_ID}/threads/new`] } },
  );
}

afterEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  delete window.MASTRA_EXPERIMENTAL_UI;
});

describe('AgentDetailHeaderActions', () => {
  describe('when displaying the route header', () => {
    it('renders Share and the Config toggle inside the route header slot', async () => {
      installHandlers();
      renderActions();

      const slot = screen.getByTestId('header-actions');
      await waitFor(() => expect(slot.querySelector('[data-testid="agent-entity-header-share"]')).not.toBeNull());
      const toggle = screen.getByTestId('agent-overview-panel-toggle');
      expect(slot.contains(toggle)).toBe(true);
      expect(toggle.getAttribute('aria-pressed')).toBe('false');
    });

    it('drives the layout panel handle and mirrors its collapsed state', async () => {
      installHandlers();
      renderActions();

      const toggle = await screen.findByTestId('agent-overview-panel-toggle');
      fireEvent.click(toggle);
      expect(panelHandle.toggle).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByText('report-expanded'));
      expect(toggle.getAttribute('aria-pressed')).toBe('true');
    });
  });

  describe('when displaying a code-defined agent', () => {
    it('hides the Edit button for code-defined agents', async () => {
      installHandlers();
      renderActions();

      await screen.findByTestId('agent-entity-header-share');
      await waitFor(() => expect(screen.queryByText('Edit')).toBeNull());
    });
  });

  describe('when Agent Builder is enabled for a stored agent', () => {
    it('shows the Edit button for stored agents when the user can create agents', async () => {
      installHandlers(storedAgent);
      renderActions();

      const edit = await screen.findByText('Edit');
      expect(edit.closest('a')?.getAttribute('href')).toBe(`/agent-builder/agents/${AGENT_ID}/edit`);
    });

    it('opens the Agent Builder editor when clicking Edit', async () => {
      installHandlers(storedAgent);
      renderActions();

      fireEvent.click(await screen.findByRole('link', { name: 'Edit' }));

      expect(await screen.findByText('Agent Builder editor')).not.toBeNull();
    });
  });

  describe('when Agent Builder is disabled and the experimental UI flag is set', () => {
    it('does not expose the retired CMS editor', async () => {
      window.MASTRA_EXPERIMENTAL_UI = 'true';
      installHandlers(storedAgent, false);
      const { queryClient } = renderActions();

      await waitFor(() => expect(queryClient.isFetching()).toBe(0));
      expect(screen.queryByRole('link', { name: 'Edit' })).toBeNull();
    });
  });
});
