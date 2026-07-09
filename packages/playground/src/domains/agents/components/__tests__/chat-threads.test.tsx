import type { StorageThreadType } from '@mastra/core/memory';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { forwardRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ChatThreads } from '../chat-threads';
import { readOnlyAuthCapabilities } from './fixtures/auth';
import { LinkComponentProvider } from '@/lib/framework';
import type { LinkComponentProviderProps } from '@/lib/framework';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

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

function renderWithProviders(children: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <LinkComponentProvider Link={StubLink} navigate={() => {}} paths={paths}>
          {children}
        </LinkComponentProvider>
      </QueryClientProvider>
    </MastraReactProvider>,
  );
}

afterEach(cleanup);

function thread(overrides: Partial<StorageThreadType>): StorageThreadType {
  const createdAt = new Date(2026, 4, 29, 16, 19, 44);

  return {
    id: 'thread-id',
    resourceId: 'chef-agent',
    createdAt,
    updatedAt: createdAt,
    ...overrides,
  };
}

describe('ChatThreads', () => {
  it('renders real titles and default-title fallbacks with the same truncating title UI', async () => {
    const realTitle = 'ThisIsAReallyLongUnbrokenThreadTitle';
    const fallbackDate = new Date(2026, 4, 29, 16, 19, 44);
    const onAuthCapabilities = vi.fn();

    server.use(
      http.get(`${BASE_URL}/api/auth/capabilities`, () => {
        onAuthCapabilities();
        return HttpResponse.json(readOnlyAuthCapabilities);
      }),
    );

    renderWithProviders(
      <ChatThreads
        threads={[
          thread({ id: 'real-thread', title: realTitle }),
          thread({
            id: 'default-thread',
            title: 'New Thread 2026-05-29T14:19:44.000Z',
            createdAt: fallbackDate,
            updatedAt: fallbackDate,
          }),
        ]}
        threadId="real-thread"
        onDelete={vi.fn()}
        resourceId="chef-agent"
        resourceType="agent"
      />,
    );

    await waitFor(() => expect(onAuthCapabilities).toHaveBeenCalled());

    const realTitleElement = await screen.findByText(realTitle);
    const fallbackTitleElement = screen.getByText('May 29 at 4:19:44 PM');

    expect(realTitleElement.className).toBe('block truncate');
    expect(fallbackTitleElement.className).toBe(realTitleElement.className);
  });
});
