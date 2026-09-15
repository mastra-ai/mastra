import type { GetAgentResponse } from '@mastra/client-js';
import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import type { CollapsiblePanelHandle } from '@mastra/playground-ui/resize/collapsible-panel';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useImperativeHandle } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AgentDetailHeaderActions } from '../agent-detail-header-actions';
import { v2Agent } from './fixtures/composer-model-settings';
import { RouteHeaderActionsProvider, RouteHeaderActionsSlot } from '@/lib/route-header/route-header-actions';
import { RouteSidePanelProvider, useRouteSidePanel } from '@/lib/route-side-panel';
import { TestLinkProvider } from '@/test/link-provider';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

const AGENT_ID = 'agent-1';
const storedAgent: GetAgentResponse = { ...v2Agent, source: 'stored' };

function installHandlers(agent: GetAgentResponse = v2Agent) {
  server.use(
    http.get(`${TEST_BASE_URL}/api/agents/${AGENT_ID}`, () => HttpResponse.json(agent)),
    http.get(`${TEST_BASE_URL}/api/auth/capabilities`, () => HttpResponse.json({ enabled: false })),
    http.get(`${TEST_BASE_URL}/api/system/packages`, () => HttpResponse.json({ packages: [] })),
    http.get(`${TEST_BASE_URL}/api/editor/builder/settings`, () => HttpResponse.json({})),
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
    <TestLinkProvider>
      <TooltipProvider>
        <RouteHeaderActionsProvider>
          <RouteSidePanelProvider>
            <div data-testid="header-actions">
              <RouteHeaderActionsSlot />
            </div>
            <FakeLayoutPanel />
            <AgentDetailHeaderActions agentId={AGENT_ID} />
          </RouteSidePanelProvider>
        </RouteHeaderActionsProvider>
      </TooltipProvider>
    </TestLinkProvider>,
    { router: true },
  );
}

afterEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  delete (window as unknown as Record<string, unknown>).MASTRA_EXPERIMENTAL_UI;
});

describe('AgentDetailHeaderActions', () => {
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

  it('hides the Edit button for code-defined agents', async () => {
    (window as unknown as Record<string, unknown>).MASTRA_EXPERIMENTAL_UI = 'true';
    installHandlers();
    renderActions();

    await screen.findByTestId('agent-entity-header-share');
    await waitFor(() => expect(screen.queryByText('Edit')).toBeNull());
  });

  it('shows the Edit button for stored agents when the user can create agents', async () => {
    (window as unknown as Record<string, unknown>).MASTRA_EXPERIMENTAL_UI = 'true';
    installHandlers(storedAgent);
    renderActions();

    const edit = await screen.findByText('Edit');
    expect(edit.closest('a')?.getAttribute('href')).toBe(`/cms/agents/${AGENT_ID}`);
  });
});
