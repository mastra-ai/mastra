// @vitest-environment jsdom
import type { StorageThreadType } from '@mastra/core/memory';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { AnchorHTMLAttributes } from 'react';
import { forwardRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ThreadInputProvider } from '@/domains/conversation/context/ThreadInputContext';
import { WorkingMemoryProvider } from '@/domains/agents/context/agent-working-memory-context';
import { LinkComponentProvider } from '@/lib/framework';
import type { LinkComponentProviderProps } from '@/lib/framework';
import { server } from '@/test/msw-server';
import { MemorySidebar } from '../memory-sidebar';
import { readOnlyAuthCapabilities } from '../../__tests__/fixtures/auth';
import { memoryEnabledStatus, semanticRecallConfig } from './fixtures/memory';

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

function renderSidebar(threads: StorageThreadType[]) {
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
  it('renders the Memory title and shows the Threads tab content by default', async () => {
    const { container } = renderSidebar([thread({ id: THREAD_ID, title: 'My first chat' })]);

    expect(await screen.findByText('Memory')).not.toBeNull();
    // Threads tab is active by default: the thread list (with New Chat) is visible.
    expect(await screen.findByText('New Chat')).not.toBeNull();
    expect(await screen.findByText('My first chat')).not.toBeNull();

    // The sidebar is a single standalone block (rounded + bordered) containing the Memory header,
    // and there is exactly one such bordered block on the Threads tab (no nested container).
    const blocks = container.querySelectorAll('.rounded-studio-panel.border-border1\\/50');
    expect(blocks.length).toBe(1);
    expect(blocks[0].textContent).toContain('Memory');
  });

  it('shows the AgentMemory configuration content when the Configuration tab is selected', async () => {
    renderSidebar([thread({ id: THREAD_ID, title: 'My first chat' })]);

    fireEvent.click(await screen.findByRole('tab', { name: 'Configuration' }));

    // AgentMemory renders a "Clone Thread" section whenever a real thread is present.
    const cloneSection = await screen.findByText('Clone Thread');

    // The whole Configuration panel scrolls on Y: the active tabpanel is the scroll container,
    // and AgentMemory's root must not trap scrolling with its own h-full/overflow-hidden.
    const panel = cloneSection.closest('[role="tabpanel"]');
    expect(panel).not.toBeNull();
    expect(panel?.className).toContain('overflow-y-auto');

    const agentMemoryRoot = panel?.firstElementChild;
    expect(agentMemoryRoot?.className).not.toContain('overflow-hidden');
    expect(agentMemoryRoot?.className).not.toContain('h-full');
  });

  it('restores the persisted Configuration tab on mount', async () => {
    sessionStorage.setItem('agent-memory-sidebar-tab', 'configuration');

    renderSidebar([thread({ id: THREAD_ID, title: 'My first chat' })]);

    expect(await screen.findByText('Clone Thread')).not.toBeNull();
  });
});
