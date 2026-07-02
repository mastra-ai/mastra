import type { AgentVersionResponse, StoredAgentResponse } from '@mastra/client-js';
import type { StorageThreadType } from '@mastra/core/memory';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { AnchorHTMLAttributes } from 'react';
import { forwardRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { agentVersionsResponse } from '../../__tests__/fixtures/agent-versions';
import { readOnlyAuthCapabilities } from '../../__tests__/fixtures/auth';
import { systemPackages } from '../../__tests__/fixtures/channels';
import { v2Agent } from '../../__tests__/fixtures/composer-model-settings';
import { observationalMemory, threadMessages } from '../../__tests__/fixtures/memory-panel';
import { MemorySidebar } from '../memory-sidebar';
import {
  memoryEnabledStatus,
  observationalMemoryConfig,
  observationalMemoryConfigWithThresholds,
  observationalMemoryTwoRecords,
  observationalMemoryWithRecord,
  semanticRecallConfig,
  threadMessagesSpan,
} from './fixtures/memory';
import {
  ObservationalMemoryProvider,
  useObservationalMemoryContext,
} from '@/domains/agents/context/agent-observational-memory-context';
import { AgentSidebarViewProvider, useAgentSidebarView } from '@/domains/agents/context/agent-sidebar-view-context';
import { WorkingMemoryProvider } from '@/domains/agents/context/agent-working-memory-context';
import { MemoryTimelineProvider, useMemoryTimeline } from '@/domains/agents/context/memory-timeline-context';
import { ThreadInputProvider } from '@/domains/conversation/context/ThreadInputContext';
import { LinkComponentProvider } from '@/lib/framework';
import type { LinkComponentProviderProps } from '@/lib/framework';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
const AGENT_ID = 'chef-agent';
const THREAD_ID = 'real-thread';

const capabilityAgent = {
  ...v2Agent,
  id: AGENT_ID,
  name: 'Chef Agent',
  inputProcessors: [{ id: 'guardrail', name: 'Guardrail' }],
};

const versionsForAgent = {
  ...agentVersionsResponse,
  versions: agentVersionsResponse.versions.map(version => ({
    ...version,
    agentId: AGENT_ID,
    name: 'Chef Agent',
  })),
};

const storedAgentResponse = {
  id: AGENT_ID,
  status: 'draft',
  activeVersionId: 'version-1',
  createdAt: '2026-06-21T10:00:00.000Z',
  updatedAt: '2026-06-22T10:00:00.000Z',
  name: 'Chef Agent',
  instructions: [{ id: 'intro', type: 'prompt_block', content: 'You are a test chef agent.' }],
  model: { provider: 'openai', name: 'gpt-4o-mini' },
  tools: {},
  workflows: {},
  agents: {},
  integrationTools: {},
  mcpClients: {},
  scorers: {},
  skills: {},
  requestContextSchema: { type: 'object', properties: {} },
} satisfies StoredAgentResponse;

// The version editor loads the active version (version-1) when opened. Serve it
// with the same draft instructions so the panel renders the agent's prompt.
const activeVersionDetail = {
  ...versionsForAgent.versions[1],
  instructions: storedAgentResponse.instructions,
} satisfies AgentVersionResponse;

const StubLink = forwardRef<HTMLAnchorElement, AnchorHTMLAttributes<HTMLAnchorElement> & { to?: string }>(
  ({ children, to, href, ...props }, ref) => (
    <a ref={ref} href={to ?? href} {...props}>
      {children}
    </a>
  ),
);

const paths = {
  agentLink: (agentId: string) => `/agents/${agentId}`,
  agentsLink: () => '/agents',
  agentToolLink: (agentId: string, toolId: string) => `/agents/${agentId}/tools/${toolId}`,
  agentSkillLink: (agentId: string, skillName: string) => `/agents/${agentId}/skills/${skillName}`,
  agentThreadLink: (agentId: string, threadId: string) => `/agents/${agentId}/chat/${threadId}`,
  agentNewThreadLink: (agentId: string) => `/agents/${agentId}/chat/new`,
  agentVersionThreadLink: (agentId: string, versionId: string, threadId: string) =>
    `/agents/${agentId}/versions/${versionId}/chat/${threadId}`,
  agentVersionNewThreadLink: (agentId: string, versionId: string) =>
    `/agents/${agentId}/versions/${versionId}/chat/new`,
  workflowsLink: () => '/workflows',
  workflowLink: (workflowId: string) => `/workflows/${workflowId}`,
  schedulesLink: () => '/schedules',
  scheduleLink: (scheduleId: string) => `/schedules/${scheduleId}`,
  networkLink: (networkId: string) => `/networks/${networkId}`,
  networkNewThreadLink: (networkId: string) => `/networks/${networkId}/chat/new`,
  networkThreadLink: (networkId: string, threadId: string) => `/networks/${networkId}/chat/${threadId}`,
  scorerLink: (scorerId: string) => `/scorers/${scorerId}`,
  cmsScorersCreateLink: () => '/cms/scorers/create',
  cmsScorerEditLink: (scorerId: string) => `/cms/scorers/${scorerId}`,
  cmsAgentCreateLink: () => '/cms/agents/create',
  promptBlockLink: (promptBlockId: string) => `/prompt-blocks/${promptBlockId}`,
  promptBlocksLink: () => '/prompt-blocks',
  cmsPromptBlockCreateLink: () => '/cms/prompt-blocks/create',
  cmsPromptBlockEditLink: (promptBlockId: string) => `/cms/prompt-blocks/${promptBlockId}`,
  toolLink: (toolId: string) => `/tools/${toolId}`,
  skillLink: (skillName: string) => `/skills/${skillName}`,
  workspacesLink: () => '/workspaces',
  workspaceLink: (workspaceId?: string) => `/workspaces/${workspaceId ?? ''}`,
  workspaceSkillLink: (skillName: string) => `/workspaces/skills/${skillName}`,
  processorsLink: () => '/processors',
  processorLink: (processorId: string) => `/processors/${processorId}`,
  mcpServerLink: (serverId: string) => `/mcp/${serverId}`,
  mcpServerToolLink: (serverId: string, toolId: string) => `/mcp/${serverId}/tools/${toolId}`,
  workflowRunLink: (workflowId: string, runId: string) => `/workflows/${workflowId}/runs/${runId}`,
  datasetLink: (datasetId: string) => `/datasets/${datasetId}`,
  datasetItemLink: (datasetId: string, itemId: string) => `/datasets/${datasetId}/items/${itemId}`,
  datasetExperimentLink: (datasetId: string, experimentId: string) =>
    `/datasets/${datasetId}/experiments/${experimentId}`,
  experimentLink: (experimentId: string) => `/experiments/${experimentId}`,
} satisfies LinkComponentProviderProps['paths'];

function registerMemoryHandlers() {
  server.use(
    http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json(readOnlyAuthCapabilities)),
    http.get(`${BASE_URL}/api/agents/${AGENT_ID}`, () => HttpResponse.json(capabilityAgent)),
    http.get(`${BASE_URL}/api/system/packages`, () => HttpResponse.json({ ...systemPackages, cmsEnabled: true })),
    http.get(`${BASE_URL}/api/stored/agents/${AGENT_ID}`, () => HttpResponse.json(storedAgentResponse)),
    http.get(`${BASE_URL}/api/stored/agents/${AGENT_ID}/versions`, () => HttpResponse.json(versionsForAgent)),
    http.get(`${BASE_URL}/api/stored/agents/${AGENT_ID}/versions/:versionId`, () =>
      HttpResponse.json(activeVersionDetail),
    ),
    http.get(`${BASE_URL}/api/tools`, () => HttpResponse.json({})),
    http.get(`${BASE_URL}/api/memory/config`, () => HttpResponse.json(semanticRecallConfig)),
    http.get(`${BASE_URL}/api/memory/status`, () => HttpResponse.json(memoryEnabledStatus)),
    http.get(`${BASE_URL}/api/memory/threads/:threadId`, () =>
      HttpResponse.json({ id: THREAD_ID, resourceId: AGENT_ID, createdAt: new Date().toISOString() }),
    ),
    http.get(`${BASE_URL}/api/memory/threads/:threadId/working-memory`, () =>
      HttpResponse.json({ workingMemory: null, source: 'thread' }),
    ),
  );
}

function OpenVersionsButton() {
  const { openVersions } = useAgentSidebarView();
  return (
    <button type="button" onClick={openVersions}>
      Open versions
    </button>
  );
}

// Exposes the OM context's `signalObservationsUpdated` so a test can simulate a
// stream-finish freshness signal, mirroring how the chat provider pokes the panel.
let signalObservationsUpdated: () => void = () => {};
function SignalProbe() {
  const ctx = useObservationalMemoryContext();
  signalObservationsUpdated = ctx.signalObservationsUpdated;
  return null;
}

// Exposes the memory-timeline open/close controls so a test can drive the OM
// detail panel the same way the surviving "Analyze Observations" CTA does,
// without depending on a sidebar-local toggle button.
let openPanel: () => void = () => {};
function TimelineProbe() {
  const ctx = useMemoryTimeline();
  openPanel = ctx.openPanel;
  return null;
}

function renderSidebar(threads: StorageThreadType[], hasMemory = true) {
  if (!hasMemory) {
    server.use(http.get(`${BASE_URL}/api/memory/status`, () => HttpResponse.json({ result: false })));
  }

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <LinkComponentProvider Link={StubLink} navigate={() => {}} paths={paths}>
          <ThreadInputProvider>
            <AgentSidebarViewProvider>
              <OpenVersionsButton />
              <WorkingMemoryProvider agentId={AGENT_ID} threadId={THREAD_ID} resourceId={AGENT_ID}>
                <ObservationalMemoryProvider>
                  <MemoryTimelineProvider>
                    <SignalProbe />
                    <TimelineProbe />
                    <MemorySidebar agentId={AGENT_ID} threadId={THREAD_ID} threads={threads} onDelete={vi.fn()} />
                  </MemoryTimelineProvider>
                </ObservationalMemoryProvider>
              </WorkingMemoryProvider>
            </AgentSidebarViewProvider>
          </ThreadInputProvider>
        </LinkComponentProvider>
      </QueryClientProvider>
    </MastraReactProvider>,
  );
}

function thread(overrides: Partial<StorageThreadType>): StorageThreadType {
  const createdAt = new Date(2026, 4, 29, 16, 19, 44);
  return {
    id: 'thread-id',
    resourceId: AGENT_ID,
    createdAt,
    updatedAt: createdAt,
    ...overrides,
  };
}

beforeEach(() => {
  sessionStorage.clear();
  registerMemoryHandlers();
});

afterEach(cleanup);

describe('MemorySidebar', () => {
  it('renders the Memory card as an overlay above the thread list by default', async () => {
    const { container } = renderSidebar([thread({ id: THREAD_ID, title: 'My first chat' })]);

    // Threads view is the default: the thread list (with New Chat) is visible.
    const newChat = await screen.findByText('New Chat');
    expect(newChat).not.toBeNull();
    expect(await screen.findByText('My first chat')).not.toBeNull();

    // No header row or tabs: a top card is the entry point to the memory view.
    const card = screen.getByTestId('memory-sidebar-card');
    expect(card.textContent).toMatch(/memory/i);
    expect(card.getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByTestId('memory-sidebar-thread-layer').textContent).toContain('New Chat');
    expect(card.closest('[data-testid="memory-sidebar-overlay"]')?.className).toContain('absolute');
    expect(card.closest('[data-testid="memory-sidebar-overlay"]')?.className).toContain('z-10');
    expect(card.closest('[data-testid="memory-sidebar-overlay"]')?.className).toContain('rounded-xl');
    expect(card.className).toContain('bg-transparent');
    expect(screen.queryByRole('tab')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Threads' })).toBeNull();

    // The sidebar is still a single standalone block (rounded + bordered) with no nested container.
    const blocks = container.querySelectorAll('.rounded-tr-studio-panel.border-border1\\/50');
    expect(blocks.length).toBe(1);
  });

  it('shows a compact capabilities footer at the bottom of the thread layer', async () => {
    renderSidebar([thread({ id: THREAD_ID, title: 'My first chat' })]);

    const footer = await screen.findByTestId('agent-capabilities-footer');

    expect(await within(footer).findByLabelText('Memory: On')).not.toBeNull();
    expect(await within(footer).findByLabelText('Editor: 2')).not.toBeNull();
    expect(within(footer).getByText('3/6')).not.toBeNull();

    fireEvent.click(footer);

    expect(screen.getAllByLabelText('Memory: On').length).toBeGreaterThan(1);
    expect(screen.getAllByLabelText('Editor: 2').length).toBeGreaterThan(1);
    expect(screen.getAllByLabelText('Processors: 1').length).toBeGreaterThan(1);
    expect(screen.getAllByLabelText('Tools: Off').length).toBeGreaterThan(1);
    expect(screen.getByRole('link', { name: 'Editor: 2' }).getAttribute('href')).toBe(
      'https://mastra.ai/docs/editor/overview',
    );
    expect(screen.getByRole('link', { name: 'Memory: On' }).getAttribute('href')).toBe(
      'https://mastra.ai/docs/memory/overview',
    );
  });

  it('replaces the panel with an empty state and docs CTA when memory is disabled', async () => {
    renderSidebar([], false);

    // The empty state explains memory is required; the thread list / New Chat is not rendered.
    expect(await screen.findByText('Memory not enabled')).not.toBeNull();
    expect(screen.queryByText('New Chat')).toBeNull();

    // The memory card is hidden entirely when memory is off.
    expect(screen.queryByTestId('memory-sidebar-card')).toBeNull();

    // An outline CTA links to the Agent Memory docs.
    const cta = screen.getByRole('link', { name: /documentation/i });
    expect(cta.getAttribute('href')).toBe('https://mastra.ai/docs/memory/overview');
  });

  it('shows the version editor as the full sidebar view without leaving chat', async () => {
    renderSidebar([thread({ id: THREAD_ID, title: 'My first chat' })]);

    fireEvent.click(screen.getByRole('button', { name: 'Open versions' }));

    expect(await screen.findByRole('combobox', { name: /switch chef agent version/i })).not.toBeNull();
    expect(screen.getByText('You are a test chef agent.')).not.toBeNull();
    expect(screen.queryByTestId('memory-sidebar-thread-layer')).toBeNull();
    expect(screen.queryByTestId('memory-sidebar-card')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Back to threads' }));

    expect(await screen.findByText('New Chat')).not.toBeNull();
    expect(screen.getByTestId('memory-sidebar-card')).not.toBeNull();
  });

  it('shows the live memory content, without the static config, when the Memory card is clicked', async () => {
    renderSidebar([thread({ id: THREAD_ID, title: 'My first chat' })]);

    fireEvent.click(await screen.findByTestId('memory-sidebar-card'));

    // AgentMemory renders a "Clone Thread" section whenever a real thread is present.
    const cloneSection = await screen.findByText('Clone Thread');

    // The card reflects the active view.
    expect(screen.getByTestId('memory-sidebar-card').getAttribute('aria-pressed')).toBe('true');

    // The static memory configuration (AgentMemoryConfig with its "General"
    // section) moved to the agent settings view and is no longer in the panel.
    expect(screen.queryByText('General')).toBeNull();

    // The whole Memory view scrolls on Y, and AgentMemory's root must not trap
    // scrolling with its own h-full/overflow-hidden.
    const panel = cloneSection.closest('.overflow-y-auto');
    expect(panel).not.toBeNull();

    const agentMemoryRoot = panel?.firstElementChild;
    expect(agentMemoryRoot?.className).not.toContain('overflow-hidden');
    expect(agentMemoryRoot?.className).not.toContain('h-full');
  });

  it('replaces the memory content with the OM detail when opened and restores it on Back, gating fetches until opened', async () => {
    const onOM = vi.fn();
    const onMessages = vi.fn();

    server.use(
      http.get(`${BASE_URL}/api/memory/config`, () => HttpResponse.json(observationalMemoryConfig)),
      http.get(`${BASE_URL}/api/memory/observational-memory`, () => {
        onOM();
        return HttpResponse.json(observationalMemory);
      }),
      http.get(`${BASE_URL}/api/memory/threads/${THREAD_ID}/messages`, () => {
        onMessages();
        return HttpResponse.json(threadMessages);
      }),
    );

    renderSidebar([thread({ id: THREAD_ID, title: 'My first chat' })]);

    const memoryCard = await screen.findByTestId('memory-sidebar-card');
    await act(async () => {
      fireEvent.click(memoryCard);
    });

    await screen.findByText('Clone Thread');
    expect(screen.queryByTestId('memory-sidebar-om-detail-subpanel')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Back to memory' })).toBeNull();
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(onOM).not.toHaveBeenCalled();
    expect(onMessages).not.toHaveBeenCalled();

    act(() => openPanel());

    const subpanel = await screen.findByTestId('memory-sidebar-om-detail-subpanel');
    expect(subpanel.closest('[data-testid="memory-sidebar-panel"]')).not.toBeNull();
    expect(await screen.findByRole('button', { name: 'Back to memory' })).not.toBeNull();
    await waitFor(() => expect(screen.queryByText('Clone Thread')).toBeNull());
    await waitFor(() => expect(onOM).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(onMessages).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('button', { name: 'Back to memory' }));

    await waitFor(() => expect(screen.queryByTestId('memory-sidebar-om-detail-subpanel')).toBeNull());
    expect(screen.queryByRole('button', { name: 'Back to memory' })).toBeNull();
    expect(await screen.findByText('Clone Thread')).not.toBeNull();
  });

  it('refetches the open OM subpanel when observations are signalled after a stream finishes', async () => {
    const onOM = vi.fn();
    const onMessages = vi.fn();

    server.use(
      http.get(`${BASE_URL}/api/memory/config`, () => HttpResponse.json(observationalMemoryConfig)),
      http.get(`${BASE_URL}/api/memory/observational-memory`, () => {
        onOM();
        return HttpResponse.json(observationalMemory);
      }),
      http.get(`${BASE_URL}/api/memory/threads/${THREAD_ID}/messages`, () => {
        onMessages();
        return HttpResponse.json(threadMessages);
      }),
    );

    renderSidebar([thread({ id: THREAD_ID, title: 'My first chat' })]);

    fireEvent.click(await screen.findByTestId('memory-sidebar-card'));
    act(() => openPanel());

    await screen.findByTestId('memory-sidebar-om-detail-subpanel');
    await waitFor(() => expect(onOM).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(onMessages).toHaveBeenCalledTimes(1));

    await act(async () => {
      signalObservationsUpdated();
    });

    await waitFor(() => expect(onOM).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(onMessages).toHaveBeenCalledTimes(2));
  });

  it('renders Messages and Observations progress bars from the OM record context window', async () => {
    server.use(
      http.get(`${BASE_URL}/api/memory/config`, () => HttpResponse.json(observationalMemoryConfigWithThresholds)),
      http.get(`${BASE_URL}/api/memory/observational-memory`, () => HttpResponse.json(observationalMemoryWithRecord)),
      http.get(`${BASE_URL}/api/memory/threads/${THREAD_ID}/messages`, () => HttpResponse.json(threadMessages)),
    );

    renderSidebar([thread({ id: THREAD_ID, title: 'My first chat' })]);

    fireEvent.click(await screen.findByTestId('memory-sidebar-card'));
    act(() => openPanel());

    const subpanel = await screen.findByTestId('memory-sidebar-om-detail-subpanel');

    expect((await within(subpanel).findAllByText('Messages')).length).toBeGreaterThan(0);
    expect((await within(subpanel).findAllByText('Observations')).length).toBeGreaterThan(0);
    expect(await within(subpanel).findByText('14.2/30k')).not.toBeNull();
    expect(await within(subpanel).findByText('4.5/6k')).not.toBeNull();
  });

  it('filters the observation list to the selected zoom range', async () => {
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(800);
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(120);

    server.use(
      http.get(`${BASE_URL}/api/memory/config`, () => HttpResponse.json(observationalMemoryConfig)),
      http.get(`${BASE_URL}/api/memory/observational-memory`, () => HttpResponse.json(observationalMemoryTwoRecords)),
      http.get(`${BASE_URL}/api/memory/threads/${THREAD_ID}/messages`, () => HttpResponse.json(threadMessagesSpan)),
    );

    renderSidebar([thread({ id: THREAD_ID, title: 'My first chat' })]);

    fireEvent.click(await screen.findByTestId('memory-sidebar-card'));
    act(() => openPanel());

    await screen.findByTestId('memory-sidebar-om-detail-subpanel');

    const bodyBefore = await screen.findByTestId('observation-detail-body');
    expect(within(bodyBefore).getByText(/User reported a blocking bug/)).toBeTruthy();

    const track = document.querySelector('.cursor-pointer.select-none') as HTMLElement;
    expect(track).toBeTruthy();
    track.getBoundingClientRect = () => ({ left: 0, width: 100, top: 0, height: 24 }) as DOMRect;
    fireEvent.mouseDown(track, { clientX: 100 });
    fireEvent.mouseMove(window, { clientX: 40 });
    fireEvent.mouseUp(window);

    await waitFor(() => {
      const bodyAfter = screen.getByTestId('observation-detail-body');
      expect(within(bodyAfter).getByText(/User asked about onboarding/)).toBeTruthy();
      expect(within(bodyAfter).queryByText(/User reported a blocking bug/)).toBeNull();
    });

    fireEvent.click(screen.getByLabelText('Reset zoom'));
    await waitFor(() => {
      expect(screen.getByText(/User reported a blocking bug/)).toBeTruthy();
    });
  });

  it('returns to the thread list when the card is clicked again', async () => {
    renderSidebar([thread({ id: THREAD_ID, title: 'My first chat' })]);

    fireEvent.click(await screen.findByTestId('memory-sidebar-card'));
    await screen.findByText('Clone Thread');

    fireEvent.click(screen.getByTestId('memory-sidebar-card'));

    expect(await screen.findByText('New Chat')).not.toBeNull();
    expect(screen.queryByText('Clone Thread')).toBeNull();
  });

  it('restores the persisted Memory view on mount', async () => {
    sessionStorage.setItem('agent-memory-sidebar-tab-v2', 'memory');

    renderSidebar([thread({ id: THREAD_ID, title: 'My first chat' })]);

    expect(await screen.findByText('Clone Thread')).not.toBeNull();
  });

  it('ignores the stale v1 sessionStorage key pointing at the removed configuration tab', async () => {
    sessionStorage.setItem('agent-memory-sidebar-tab', 'configuration');

    renderSidebar([thread({ id: THREAD_ID, title: 'My first chat' })]);

    // Falls back to the thread list instead of an unknown view value.
    expect(await screen.findByText('New Chat')).not.toBeNull();
  });
});
