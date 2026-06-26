import type { StorageThreadType } from '@mastra/core/memory';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { AnchorHTMLAttributes } from 'react';
import { forwardRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { readOnlyAuthCapabilities } from '../../__tests__/fixtures/auth';
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
import { WorkingMemoryProvider } from '@/domains/agents/context/agent-working-memory-context';
import { MemoryTimelineProvider, useMemoryTimeline } from '@/domains/agents/context/memory-timeline-context';
import { ThreadInputProvider } from '@/domains/conversation/context/ThreadInputContext';
import { LinkComponentProvider } from '@/lib/framework';
import type { LinkComponentProviderProps } from '@/lib/framework';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
const AGENT_ID = 'chef-agent';
const THREAD_ID = 'real-thread';

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
  cmsAgentEditLink: (agentId: string) => `/cms/agents/${agentId}`,
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

function renderSidebar(threads: StorageThreadType[], hasMemory = true) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <LinkComponentProvider Link={StubLink} navigate={() => {}} paths={paths}>
          <ThreadInputProvider>
            <WorkingMemoryProvider agentId={AGENT_ID} threadId={THREAD_ID} resourceId={AGENT_ID}>
              <MemoryTimelineProvider>
                <TimelineProbe />
                <MemorySidebar
                  agentId={AGENT_ID}
                  threadId={THREAD_ID}
                  threads={threads}
                  isLoading={false}
                  onDelete={vi.fn()}
                  hasMemory={hasMemory}
                />
              </MemoryTimelineProvider>
            </WorkingMemoryProvider>
          </ThreadInputProvider>
        </LinkComponentProvider>
      </QueryClientProvider>
    </MastraReactProvider>,
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

function renderSidebarWithOM(threads: StorageThreadType[]) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <LinkComponentProvider Link={StubLink} navigate={() => {}} paths={paths}>
          <ThreadInputProvider>
            <WorkingMemoryProvider agentId={AGENT_ID} threadId={THREAD_ID} resourceId={AGENT_ID}>
              <ObservationalMemoryProvider>
                <MemoryTimelineProvider>
                  <SignalProbe />
                  <TimelineProbe />
                  <MemorySidebar
                    agentId={AGENT_ID}
                    threadId={THREAD_ID}
                    threads={threads}
                    isLoading={false}
                    onDelete={vi.fn()}
                    hasMemory
                  />
                </MemoryTimelineProvider>
              </ObservationalMemoryProvider>
            </WorkingMemoryProvider>
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

  it('replaces the panel with an empty state and docs CTA when memory is disabled', async () => {
    renderSidebar([], false);

    // The empty state explains memory is required; the thread list / New Chat is not rendered.
    expect(await screen.findByText('Memory not enabled')).not.toBeNull();
    expect(screen.queryByText('New Chat')).toBeNull();

    // The memory card is hidden entirely when memory is off.
    expect(screen.queryByTestId('memory-sidebar-card')).toBeNull();

    // An outline CTA links to the Agent Memory docs.
    const cta = screen.getByRole('link', { name: /documentation/i });
    expect(cta.getAttribute('href')).toBe('https://mastra.ai/en/docs/agents/agent-memory');
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

    // Given the Memory view is open: the regular memory content ("Clone Thread")
    // is visible, the OM subpanel is absent, and no OM/message data is fetched.
    await screen.findByText('Clone Thread');
    expect(screen.queryByTestId('memory-sidebar-om-detail-subpanel')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Back to memory' })).toBeNull();
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(onOM).not.toHaveBeenCalled();
    expect(onMessages).not.toHaveBeenCalled();

    // When the OM detail is opened (as the "Analyze Observations" CTA does): the
    // OM detail replaces the regular memory content (fills the panel), so
    // "Clone Thread" is gone and the OM subpanel + Back button are shown.
    act(() => openPanel());

    const subpanel = await screen.findByTestId('memory-sidebar-om-detail-subpanel');
    expect(subpanel.closest('[data-testid="memory-sidebar-panel"]')).not.toBeNull();
    expect(await screen.findByRole('button', { name: 'Back to memory' })).not.toBeNull();
    await waitFor(() => expect(screen.queryByText('Clone Thread')).toBeNull());
    await waitFor(() => expect(onOM).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(onMessages).toHaveBeenCalledTimes(1));

    // When Back is clicked: the OM subpanel is removed and the regular memory
    // content returns.
    fireEvent.click(screen.getByRole('button', { name: 'Back to memory' }));

    await waitFor(() => expect(screen.queryByTestId('memory-sidebar-om-detail-subpanel')).toBeNull());
    expect(screen.queryByRole('button', { name: 'Back to memory' })).toBeNull();
    expect(await screen.findByText('Clone Thread')).not.toBeNull();
  });

  it('refetches the open OM subpanel when observations are signalled (stream-finish freshness)', async () => {
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

    renderSidebarWithOM([thread({ id: THREAD_ID, title: 'My first chat' })]);

    fireEvent.click(await screen.findByTestId('memory-sidebar-card'));
    act(() => openPanel());

    // Initial open fetches each query exactly once.
    await screen.findByTestId('memory-sidebar-om-detail-subpanel');
    await waitFor(() => expect(onOM).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(onMessages).toHaveBeenCalledTimes(1));

    // Simulating a stream-finish freshness signal must refetch both queries so the
    // panel reflects new observations without remounting, like the left OM sidebar.
    await act(async () => {
      signalObservationsUpdated();
    });

    await waitFor(() => expect(onOM).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(onMessages).toHaveBeenCalledTimes(2));
  });

  it('renders the timeline panel context window from the OM record (source of truth), not message markers', async () => {
    server.use(
      http.get(`${BASE_URL}/api/memory/config`, () => HttpResponse.json(observationalMemoryConfigWithThresholds)),
      http.get(`${BASE_URL}/api/memory/observational-memory`, () => HttpResponse.json(observationalMemoryWithRecord)),
      http.get(`${BASE_URL}/api/memory/threads/${THREAD_ID}/messages`, () => HttpResponse.json(threadMessages)),
    );

    renderSidebarWithOM([thread({ id: THREAD_ID, title: 'My first chat' })]);

    fireEvent.click(await screen.findByTestId('memory-sidebar-card'));
    act(() => openPanel());

    await screen.findByTestId('memory-sidebar-om-detail-subpanel');

    // The panel's Messages bar must show the record-derived counter:
    // pendingMessageTokens 14200 over the message threshold 30000 (14.2/30k).
    // The thread messages are plain text with no OM status markers, so a
    // marker-derived panel would show 0 here. The observation/memory readout
    // (observationTokenCount 4500 over the observation threshold 6000 → 4.5/6k)
    // is lifted into the panel header beside the "Observational memory" title.
    expect(await screen.findByText('14.2/30k')).not.toBeNull();
    expect(await screen.findByText('4.5/6k')).not.toBeNull();
  });

  it('renders both Messages and Observations progress bars in the open OM panel', async () => {
    server.use(
      http.get(`${BASE_URL}/api/memory/config`, () => HttpResponse.json(observationalMemoryConfigWithThresholds)),
      http.get(`${BASE_URL}/api/memory/observational-memory`, () => HttpResponse.json(observationalMemoryWithRecord)),
      http.get(`${BASE_URL}/api/memory/threads/${THREAD_ID}/messages`, () => HttpResponse.json(threadMessages)),
    );

    renderSidebarWithOM([thread({ id: THREAD_ID, title: 'My first chat' })]);

    fireEvent.click(await screen.findByTestId('memory-sidebar-card'));
    act(() => openPanel());

    const subpanel = await screen.findByTestId('memory-sidebar-om-detail-subpanel');

    // The OM detail panel shows two progress bars matching the collapsed sidebar:
    // a Messages bar and an Observations bar, each with record-derived readouts.
    // (Other "Messages" text can appear in the panel, so assert at least one of
    // each bar label is present, plus the exact record-derived readouts.)
    expect((await within(subpanel).findAllByText('Messages')).length).toBeGreaterThan(0);
    expect((await within(subpanel).findAllByText('Observations')).length).toBeGreaterThan(0);
    expect(await within(subpanel).findByText('14.2/30k')).not.toBeNull();
    expect(await within(subpanel).findByText('4.5/6k')).not.toBeNull();
  });

  it('filters the observation list to the selected zoom range', async () => {
    // Recharts' ResponsiveContainer needs a measurable size in jsdom so the
    // FlameGraph (and its zoom track) renders.
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(800);
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(120);

    server.use(
      http.get(`${BASE_URL}/api/memory/config`, () => HttpResponse.json(observationalMemoryConfig)),
      http.get(`${BASE_URL}/api/memory/observational-memory`, () => HttpResponse.json(observationalMemoryTwoRecords)),
      http.get(`${BASE_URL}/api/memory/threads/${THREAD_ID}/messages`, () => HttpResponse.json(threadMessagesSpan)),
    );

    renderSidebarWithOM([thread({ id: THREAD_ID, title: 'My first chat' })]);

    fireEvent.click(await screen.findByTestId('memory-sidebar-card'));
    act(() => openPanel());

    await screen.findByTestId('memory-sidebar-om-detail-subpanel');

    // Both records are visible by default: the body defaults to the latest record
    // (om-late at 10:05 → "User reported a blocking bug").
    const bodyBefore = await screen.findByTestId('observation-detail-body');
    expect(within(bodyBefore).getByText(/User reported a blocking bug/)).toBeTruthy();

    // Collapse the range by dragging the right zoom handle to ~40% of the track
    // (~10:02), which keeps om-early (10:01) and drops om-late (10:05).
    const track = document.querySelector('.cursor-pointer.select-none') as HTMLElement;
    expect(track).toBeTruthy();
    track.getBoundingClientRect = () => ({ left: 0, width: 100, top: 0, height: 24 }) as DOMRect;
    fireEvent.mouseDown(track, { clientX: 100 });
    fireEvent.mouseMove(window, { clientX: 40 });
    fireEvent.mouseUp(window);

    // Now only om-early is in range: its observation text shows and the
    // out-of-range om-late observation is gone from the list.
    await waitFor(() => {
      const bodyAfter = screen.getByTestId('observation-detail-body');
      expect(within(bodyAfter).getByText(/User asked about onboarding/)).toBeTruthy();
      expect(within(bodyAfter).queryByText(/User reported a blocking bug/)).toBeNull();
    });

    // Reset zoom restores the full list.
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
