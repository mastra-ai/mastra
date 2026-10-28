import type { GetAgentResponse } from '@mastra/client-js';
import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import type { CollapsiblePanelHandle } from '@mastra/playground-ui/resize/collapsible-panel';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useImperativeHandle } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AgentConfigPanel } from '../agent-config-panel';
import { AgentDetailHeaderActions } from '../agent-detail-header-actions';
import { v2Agent } from './fixtures/composer-model-settings';
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
        <RouteSidePanelProvider>
          <FakeLayoutPanel />
          <div data-testid="header-actions">
            <AgentDetailHeaderActions agentId={AGENT_ID} />
          </div>
        </RouteSidePanelProvider>
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

describe('when the screen is narrow', () => {
  function stubNarrowScreen() {
    vi.spyOn(window, 'matchMedia').mockImplementation(query => ({
      matches: true,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: () => false,
    }));
  }

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('opens the Config panel in a drawer from the header Config button', async () => {
    stubNarrowScreen();
    installHandlers();
    renderWithProviders(
      <TestLinkProvider>
        <TooltipProvider>
          <RouteSidePanelProvider>
            <AgentConfigPanel agentId={AGENT_ID}>
              <div data-testid="header-actions">
                <AgentDetailHeaderActions agentId={AGENT_ID} />
              </div>
            </AgentConfigPanel>
          </RouteSidePanelProvider>
        </TooltipProvider>
      </TestLinkProvider>,
      { router: true },
    );

    const toggle = await screen.findByTestId('agent-overview-panel-toggle');
    expect(screen.getByTestId('header-actions').contains(toggle)).toBe(true);
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(toggle);

    const drawer = await screen.findByRole('dialog', { name: 'Config' });
    expect(drawer.contains(screen.getByTestId('agent-overview-panel'))).toBe(true);
  });
});
