import type { GetAgentResponse } from '@mastra/client-js';
import type { StorageThreadType } from '@mastra/core/memory';
import { LinkComponentProvider } from '@mastra/playground-ui/lib/framework';
import type { LinkComponentProviderProps } from '@mastra/playground-ui/lib/framework';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { AnchorHTMLAttributes } from 'react';
import { forwardRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { readOnlyAuthCapabilities } from '../../__tests__/fixtures/auth';
import { systemPackages } from '../../__tests__/fixtures/channels';
import { v2Agent } from '../../__tests__/fixtures/composer-model-settings';
import { observationalMemory, threadMessages } from '../../__tests__/fixtures/memory-panel';
import { MemorySidebar } from '../memory-sidebar';
import {
  cappedTokenLimitedMemoryConfig,
  memoryDisabledStatus,
  memoryEnabledStatus,
  observationalMemoryConfig,
  observationalMemoryConfigWithThresholds,
  observationalMemoryTwoRecords,
  observationalMemoryWithRecord,
  semanticRecallConfig,
  threadMessagesSpan,
  tokenLimitedMemoryConfig,
} from './fixtures/memory';
import {
  ObservationalMemoryProvider,
  useObservationalMemoryContext,
} from '@/domains/agents/context/agent-observational-memory-context';
import { WorkingMemoryProvider } from '@/domains/agents/context/agent-working-memory-context';
import { MemoryTimelineProvider, useMemoryTimeline } from '@/domains/agents/context/memory-timeline-context';
import { ThreadInputProvider } from '@/domains/conversation/context/ThreadInputContext';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
const AGENT_ID = 'chef-agent';
const THREAD_ID = 'real-thread';

const capabilityAgent: GetAgentResponse = {
  ...v2Agent,
  id: AGENT_ID,
  name: 'Chef Agent',
};

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
  agentThreadLink: (agentId: string, threadId: string) => `/agents/${agentId}/threads/${threadId}`,
  agentNewThreadLink: (agentId: string) => `/agents/${agentId}/threads/new`,
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
  cmsAgentCreateLink: () => '/agent-builder/agents/create',
  cmsAgentEditLink: (agentId: string) => `/agent-builder/agents/${agentId}/edit`,
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
  experimentLink: (experimentId: string) => `/experiments/${experimentId}`,
} satisfies LinkComponentProviderProps['paths'];

function registerMemoryHandlers() {
  server.use(
    http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json(readOnlyAuthCapabilities)),
    http.get(`${BASE_URL}/api/agents/${AGENT_ID}`, () => HttpResponse.json(capabilityAgent)),
    http.get(`${BASE_URL}/api/system/packages`, () => HttpResponse.json(systemPackages)),
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

  server.use(
    http.get(`${BASE_URL}/api/memory/status`, () =>
      HttpResponse.json(hasMemory ? memoryEnabledStatus : memoryDisabledStatus),
    ),
  );

  return render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <LinkComponentProvider Link={StubLink} navigate={() => {}} paths={paths}>
          <ThreadInputProvider>
            <WorkingMemoryProvider agentId={AGENT_ID} threadId={THREAD_ID} resourceId={AGENT_ID}>
              <MemoryTimelineProvider>
                <TimelineProbe />
                <MemorySidebar agentId={AGENT_ID} threadId={THREAD_ID} threads={threads} onDelete={vi.fn()} />
              </MemoryTimelineProvider>
            </WorkingMemoryProvider>
          </ThreadInputProvider>
        </LinkComponentProvider>
      </QueryClientProvider>
    </MastraReactProvider>,
  );
}

let signalObservationsUpdated: () => void = () => {};
function SignalProbe() {
  const ctx = useObservationalMemoryContext();
  signalObservationsUpdated = ctx.signalObservationsUpdated;
  return null;
}

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
                  <MemorySidebar agentId={AGENT_ID} threadId={THREAD_ID} threads={threads} onDelete={vi.fn()} />
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
  describe.each([
    {
      name: 'history is token-limited without a message cap',
      config: tokenLimitedMemoryConfig,
      description: 'Includes recent message history with a 4000-token context budget, trimming oldest history first.',
      badge: '',
    },
    {
      name: 'history has both message and token limits',
      config: cappedTokenLimitedMemoryConfig,
      description: 'Includes the last 20 messages with a 4000-token context budget, trimming oldest history first.',
      badge: '20',
    },
  ])('when $name', ({ config, description, badge }) => {
    it('describes the configured history limits rather than rendering an object as a message count', async () => {
      server.use(http.get(`${BASE_URL}/api/memory/config`, () => HttpResponse.json(config)));
      renderSidebar([thread({ id: THREAD_ID, title: 'Token-limited chat' })]);

      await waitFor(() => {
        expect(screen.getByTestId('memory-config-badges').textContent).toBe(badge);
      });
      expect(screen.getByTestId('memory-config-badges').textContent).not.toContain('[object Object]');
      fireEvent.click(screen.getByTestId('memory-sidebar-card'));
      expect(await screen.findByText(description)).not.toBeNull();
    });
  });

  it('renders the Memory card as an overlay above the thread list by default', async () => {
    const { container } = renderSidebar([thread({ id: THREAD_ID, title: 'My first chat' })]);

    const newChat = await screen.findByText('New Thread');
    expect(newChat).not.toBeNull();
    expect(await screen.findByText('My first chat')).not.toBeNull();

    const card = screen.getByTestId('memory-sidebar-card');
    expect(card.textContent).toMatch(/memory/i);
    expect(card.getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByTestId('memory-sidebar-thread-layer').textContent).toContain('New Thread');
    expect(card.closest('[data-testid="memory-sidebar-overlay"]')?.className).toContain('absolute');
    expect(card.closest('[data-testid="memory-sidebar-overlay"]')?.className).toContain('z-10');
    expect(card.closest('[data-testid="memory-sidebar-overlay"]')?.className).toContain('rounded-xl');
    expect(screen.getByTestId('memory-config-badges')).not.toBeNull();
    expect(screen.queryByRole('tab')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Threads' })).toBeNull();

    const panels = container.querySelectorAll('[data-slot="sidebar-panel"]');
    expect(panels.length).toBe(1);
    expect(panels[0]?.contains(card)).toBe(true);
    expect(panels[0]?.contains(screen.getByTestId('memory-sidebar-thread-layer'))).toBe(true);
  });

  it('renders the capabilities footer and reveals capability details on expand', async () => {
    renderSidebar([thread({ id: THREAD_ID, title: 'My first chat' })]);

    const footer = await screen.findByTestId('agent-capabilities-footer');
    expect(footer.getAttribute('aria-expanded')).toBe('false');
    expect(footer.textContent).toMatch(/\/6/);
    expect(screen.queryByRole('link', { name: /^Tools:/ })).toBeNull();

    fireEvent.click(footer);
    expect(footer.getAttribute('aria-expanded')).toBe('true');
    const toolsRow = await screen.findByRole('link', { name: /^Tools:/ });
    expect(toolsRow.getAttribute('href')).toBe('https://mastra.ai/docs/agents/using-tools-and-mcp');
    expect(screen.getByRole('link', { name: /^Memory:/ })).not.toBeNull();
  });

  it('replaces the panel with an empty state and docs CTA when memory is disabled', async () => {
    renderSidebar([], false);

    expect(await screen.findByText('Memory not enabled')).not.toBeNull();
    expect(screen.queryByText('New Thread')).toBeNull();

    expect(screen.queryByTestId('memory-sidebar-card')).toBeNull();

    const cta = screen.getByRole('link', { name: /documentation/i });
    expect(cta.getAttribute('href')).toBe('https://mastra.ai/docs/memory/overview');
  });

  it('shows the live memory content and recent-message context when the Memory card is clicked', async () => {
    renderSidebar([thread({ id: THREAD_ID, title: 'My first chat' })]);

    fireEvent.click(await screen.findByTestId('memory-sidebar-card'));

    const cloneSection = await screen.findByText('Clone Thread');

    expect(screen.getByTestId('memory-sidebar-card').getAttribute('aria-pressed')).toBe('true');

    expect(screen.queryByText('General')).toBeNull();
    expect(screen.queryByTestId('memory-config-badges')).toBeNull();

    expect(screen.getByRole('heading', { name: 'Recent Messages' })).not.toBeNull();
    expect(screen.getByText('Includes the last 10 messages in context.')).not.toBeNull();

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

    await screen.findByTestId('memory-sidebar-om-detail-subpanel');
    await waitFor(() => expect(onOM).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(onMessages).toHaveBeenCalledTimes(1));

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

    renderSidebarWithOM([thread({ id: THREAD_ID, title: 'My first chat' })]);

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

    expect(await screen.findByText('New Thread')).not.toBeNull();
    expect(screen.queryByText('Clone Thread')).toBeNull();
  });

  it('restores the persisted Memory view on mount', async () => {
    sessionStorage.setItem('agent-memory-sidebar-tab-v2', 'memory');

    renderSidebar([thread({ id: THREAD_ID, title: 'My first chat' })]);

    expect(await screen.findByText('Clone Thread')).not.toBeNull();
  });

  it('fills the collapsed memory bar from the OM record when no status part was streamed', async () => {
    server.use(
      http.get(`${BASE_URL}/api/memory/config`, () => HttpResponse.json(observationalMemoryConfigWithThresholds)),
      http.get(`${BASE_URL}/api/memory/observational-memory`, () => HttpResponse.json(observationalMemoryWithRecord)),
    );

    renderSidebarWithOM([thread({ id: THREAD_ID, title: 'My first chat' })]);

    await waitFor(() => {
      expect(screen.getByTestId('memory-card-observation-bar').getAttribute('data-percent')).toBe('47');
    });
  });

  it('ignores the stale v1 sessionStorage key pointing at the removed configuration tab', async () => {
    sessionStorage.setItem('agent-memory-sidebar-tab', 'configuration');

    renderSidebar([thread({ id: THREAD_ID, title: 'My first chat' })]);

    expect(await screen.findByText('New Thread')).not.toBeNull();
  });
});
