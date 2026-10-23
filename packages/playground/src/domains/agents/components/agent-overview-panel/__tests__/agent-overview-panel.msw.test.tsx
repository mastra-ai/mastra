import type { GetAgentResponse, GetToolResponse } from '@mastra/client-js';
import { Toaster } from '@mastra/playground-ui/components/Toaster';
import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { ActivatedSkillsProvider } from '@mastra/playground-ui/domains/agents/context/activated-skills-context';
import type { CollapsiblePanelHandle } from '@mastra/playground-ui/resize/collapsible-panel';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useEffect, useImperativeHandle } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { emptyPlatforms, slackPlatform } from '../../__tests__/fixtures/channels';
import { dynamicFallbackAgent, memoryDisabled, v2Agent } from '../../__tests__/fixtures/composer-model-settings';
import { semanticRecallConfig } from '../../memory-sidebar/__tests__/fixtures/memory';
import { AgentOverviewPanel } from '../agent-overview-panel';
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
    http.get(`${TEST_BASE_URL}/api/editor/builder/models/available`, () => HttpResponse.json({ providers: [] })),
    http.get(`${TEST_BASE_URL}/api/agents/providers`, () => HttpResponse.json({ providers: [] })),
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
          <Toaster />
        </RouteSidePanelProvider>
      </TooltipProvider>
    </TestLinkProvider>,
    { router: true },
  );
}

afterEach(() => {
  vi.clearAllMocks();
  globalThis.localStorage?.clear();
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

  describe('model list editability', () => {
    const READ_ONLY_NOTE = 'This model list is dynamically set and cannot be edited in Studio.';

    it('shows a function-valued model list without edit controls', async () => {
      installHandlers({ agent: { ...dynamicFallbackAgent, modelListEditable: false } });
      renderPanel();

      expect(await screen.findByText(READ_ONLY_NOTE)).not.toBeNull();
      expect(screen.getByText('openai/gpt-5.4-mini')).not.toBeNull();
      expect(screen.getByText('openai/gpt-5.5')).not.toBeNull();
      expect(screen.queryAllByRole('switch')).toHaveLength(0);
    });

    it('keeps the edit controls for a static model list', async () => {
      installHandlers({ agent: { ...dynamicFallbackAgent, modelListEditable: true } });
      renderPanel();

      expect(await screen.findAllByRole('switch')).toHaveLength(2);
      expect(screen.queryByText(READ_ONLY_NOTE)).toBeNull();
    });
  });

  describe('when an unpublished model-list draft exists', () => {
    it('shows the draft model order after loading the panel', async () => {
      const publishedAgent: GetAgentResponse = { ...dynamicFallbackAgent, modelListEditable: true };
      const draftAgent: GetAgentResponse = {
        ...publishedAgent,
        modelList: publishedAgent.modelList?.toReversed(),
      };
      const requestedStatuses: Array<string | null> = [];
      installHandlers();
      server.use(
        http.get(`${TEST_BASE_URL}/api/agents/${AGENT_ID}`, ({ request }) => {
          const status = new URL(request.url).searchParams.get('status');
          requestedStatuses.push(status);
          return HttpResponse.json(status === 'draft' ? draftAgent : publishedAgent);
        }),
      );
      renderPanel();

      expect(await screen.findAllByRole('switch')).toHaveLength(2);
      expect(requestedStatuses).toEqual(['draft']);
    });
  });

  describe('when a model-list update is rejected', () => {
    it('restores the previous enabled state', async () => {
      installHandlers({ agent: dynamicFallbackAgent });
      server.use(
        http.post(`${TEST_BASE_URL}/api/agents/${AGENT_ID}/models/fallback`, () =>
          HttpResponse.json(
            { error: 'Agent model list is dynamic (model is a function) and cannot be edited' },
            { status: 409 },
          ),
        ),
      );
      renderPanel();

      const switches = await screen.findAllByRole('switch');
      expect(switches[1].getAttribute('aria-checked')).toBe('true');

      fireEvent.click(switches[1]);

      await waitFor(() => expect(switches[1].getAttribute('aria-checked')).toBe('true'));
      expect(
        await screen.findByText('Agent model list is dynamic (model is a function) and cannot be edited'),
      ).not.toBeNull();
    });
  });
});
