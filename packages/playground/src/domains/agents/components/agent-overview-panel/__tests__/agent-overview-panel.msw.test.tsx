import type { GetAgentResponse, GetToolResponse } from '@mastra/client-js';
import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import type { CollapsiblePanelHandle } from '@mastra/playground-ui/resize/collapsible-panel';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useEffect, useImperativeHandle } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { emptyPlatforms, slackPlatform } from '../../__tests__/fixtures/channels';
import { memoryDisabled, v2Agent } from '../../__tests__/fixtures/composer-model-settings';
import { semanticRecallConfig } from '../../memory-sidebar/__tests__/fixtures/memory';
import { AgentOverviewPanel } from '../agent-overview-panel';
import { ActivatedSkillsProvider } from '@/domains/agents/context/activated-skills-context';
import { RouteSidePanel, RouteSidePanelProvider, RouteSidePanelSlot, useRouteSidePanel } from '@/lib/route-side-panel';
import { TestLinkProvider } from '@/test/link-provider';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

const AGENT_ID = 'agent-1';

const makeTool = (index: number) =>
  ({ id: `tool-${index}`, description: `Tool ${index}` }) as unknown as GetToolResponse;

const agentWithManyTools: GetAgentResponse = {
  ...v2Agent,
  tools: Object.fromEntries(Array.from({ length: 12 }, (_, index) => [`tool-${index + 1}`, makeTool(index + 1)])),
};

function installHandlers({ agent = v2Agent, platforms = emptyPlatforms } = {}) {
  server.use(
    http.get(`${TEST_BASE_URL}/api/agents/${AGENT_ID}`, () => HttpResponse.json(agent)),
    http.get(`${TEST_BASE_URL}/api/memory/status`, () => HttpResponse.json(memoryDisabled)),
    http.get(`${TEST_BASE_URL}/api/memory/config`, () => HttpResponse.json(semanticRecallConfig)),
    http.get(`${TEST_BASE_URL}/api/auth/capabilities`, () => HttpResponse.json({ enabled: false })),
    http.get(`${TEST_BASE_URL}/api/system/packages`, () => HttpResponse.json({ packages: [] })),
    http.get(`${TEST_BASE_URL}/api/editor/builder/settings`, () => HttpResponse.json({})),
    http.get(`${TEST_BASE_URL}/api/scores/scorers`, () => HttpResponse.json({ scorers: [] })),
    http.get(`${TEST_BASE_URL}/api/channels/platforms`, () => HttpResponse.json(platforms)),
    http.get(`${TEST_BASE_URL}/api/channels/slack/installations`, () => HttpResponse.json([])),
  );
}

const panelHandle: CollapsiblePanelHandle = { collapse: vi.fn(), expand: vi.fn(), toggle: vi.fn() };

/** Stands in for the layout's CollapsiblePanel by binding the shared handle. */
function FakeLayoutPanel() {
  const { panelHandle: ref, onPanelResize } = useRouteSidePanel();
  useImperativeHandle(ref, () => panelHandle);
  useEffect(() => onPanelResize(380), [onPanelResize]);
  return null;
}

function renderPanel() {
  return renderWithProviders(
    <TestLinkProvider>
      <TooltipProvider>
        <RouteSidePanelProvider>
          <FakeLayoutPanel />
          <RouteSidePanelSlot />
          <RouteSidePanel owner="agent-detail">
            <ActivatedSkillsProvider>
              <AgentOverviewPanel agentId={AGENT_ID} />
            </ActivatedSkillsProvider>
          </RouteSidePanel>
        </RouteSidePanelProvider>
      </TooltipProvider>
    </TestLinkProvider>,
    { router: true },
  );
}

afterEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('AgentOverviewPanel', () => {
  it('renders the overview sections for the agent', async () => {
    installHandlers();
    renderPanel();

    expect(await screen.findByTestId('agent-overview-panel')).not.toBeNull();
    expect(await screen.findByRole('heading', { name: /^Tools/ }, { timeout: 10_000 })).not.toBeNull();
    expect(screen.getByRole('heading', { name: /^Workflows/ })).not.toBeNull();
    expect(screen.getByRole('heading', { name: /^Skills/ })).not.toBeNull();
    expect(screen.getByRole('heading', { name: 'System Prompt' })).not.toBeNull();
    expect(screen.getByRole('heading', { name: 'Memory' })).not.toBeNull();
    expect(screen.getByRole('heading', { name: 'Scorers' })).not.toBeNull();
    expect(await screen.findByText('Semantic Recall')).not.toBeNull();
  });

  it('caps long tool lists at 10 items with a +N toggle', async () => {
    installHandlers({ agent: agentWithManyTools });
    renderPanel();

    await waitFor(() => expect(screen.getAllByTestId('tool-badge')).toHaveLength(10), { timeout: 10_000 });
    const toggle = screen.getByTestId('agent-metadata-expandable-toggle');
    expect(toggle.textContent).toContain('+2');

    fireEvent.click(toggle);

    expect(screen.getAllByTestId('tool-badge')).toHaveLength(12);
    expect(screen.getByTestId('agent-metadata-expandable-toggle').textContent).toContain('Show less');
  });

  it('shows the channels section only when channel platforms exist', async () => {
    installHandlers({ platforms: slackPlatform });
    renderPanel();

    expect(await screen.findByRole('heading', { name: 'Channels' })).not.toBeNull();
    expect(await screen.findByText('Slack')).not.toBeNull();
  });

  it('hides the channels section when no channel platforms exist', async () => {
    installHandlers();
    renderPanel();

    await screen.findByRole('heading', { name: 'Memory' });
    expect(screen.queryByRole('heading', { name: 'Channels' })).toBeNull();
  });

  it('shows a skeleton while the agent is loading', async () => {
    installHandlers();
    renderPanel();

    expect(screen.getByTestId('agent-overview-panel-skeleton')).not.toBeNull();
    await screen.findByRole('heading', { name: /^Tools/ }, { timeout: 10_000 });
    expect(screen.queryByTestId('agent-overview-panel-skeleton')).toBeNull();
  });

  it('shows "Agent not found" when the agent does not exist', async () => {
    installHandlers();
    server.use(http.get(`${TEST_BASE_URL}/api/agents/${AGENT_ID}`, () => HttpResponse.json(null)));
    renderPanel();

    expect(await screen.findByText('Agent not found')).not.toBeNull();
  });
});
