// @vitest-environment jsdom
import type { StorageThreadType } from '@mastra/core/memory';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { AnchorHTMLAttributes } from 'react';
import { forwardRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { readOnlyAuthCapabilities } from '../../__tests__/fixtures/auth';
import { MemorySidebar } from '../memory-sidebar';
import { memoryEnabledStatus, semanticRecallConfig } from './fixtures/memory';
import { WorkingMemoryProvider } from '@/domains/agents/context/agent-working-memory-context';
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
              <MemorySidebar
                agentId={AGENT_ID}
                threadId={THREAD_ID}
                threads={threads}
                isLoading={false}
                onDelete={vi.fn()}
                hasMemory={hasMemory}
              />
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
