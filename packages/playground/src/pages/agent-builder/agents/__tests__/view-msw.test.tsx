// @vitest-environment jsdom
import type * as PlaygroundUi from '@mastra/playground-ui';
import { TooltipProvider } from '@mastra/playground-ui';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, cleanup, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import AgentBuilderAgentView from '../view';
import { LinkComponentProvider } from '@/lib/framework';
import { server } from '@/test/msw-server';

vi.mock('@mastra/playground-ui', async () => {
  const actual = await vi.importActual<typeof PlaygroundUi>('@mastra/playground-ui');
  return {
    ...actual,
    toast: { success: vi.fn(), error: vi.fn() },
    usePlaygroundStore: () => ({ requestContext: undefined }),
  };
});

vi.mock('@/domains/agent-builder', () => ({
  useBuilderAgentFeatures: () => ({ tools: false, memory: false, workflows: false, agents: false, skills: false }),
}));

vi.mock('@/domains/auth/hooks/use-current-user', () => ({
  useCurrentUser: () => ({ data: { id: 'user-1' }, isLoading: false }),
}));

const BASE_URL = 'http://localhost:4111';

const StubLink = ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{children}</a>;

const noopPaths = {
  agentLink: () => '',
  agentMessageLink: () => '',
  workflowLink: () => '',
  toolLink: () => '',
  scoreLink: () => '',
  scorerLink: () => '',
  toolByAgentLink: () => '',
  toolByWorkflowLink: () => '',
  promptLink: () => '',
  legacyWorkflowLink: () => '',
  policyLink: () => '',
  vNextNetworkLink: () => '',
  agentBuilderLink: () => '',
  mcpServerLink: () => '',
  mcpServerToolLink: () => '',
  workflowRunLink: () => '',
  datasetLink: () => '',
  datasetItemLink: () => '',
  datasetExperimentLink: () => '',
  experimentLink: () => '',
} as never;

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <LinkComponentProvider Link={StubLink as never} navigate={() => {}} paths={noopPaths}>
          <TooltipProvider>
            <MemoryRouter initialEntries={['/agent-builder/agents/agent-123/view']}>
              <Routes>
                <Route path="/agent-builder/agents/:id/view" element={<AgentBuilderAgentView />} />
              </Routes>
            </MemoryRouter>
          </TooltipProvider>
        </LinkComponentProvider>
      </QueryClientProvider>
    </MastraReactProvider>,
  );
}

const storedAgent = {
  id: 'agent-123',
  name: 'MSW Agent',
  description: 'Loaded from stored agent API',
  instructions: 'Do useful things',
  tools: [],
  agents: [],
  workflows: [],
  status: 'draft',
  visibility: 'public',
  model: { provider: 'openai', name: 'gpt-4' },
  authorId: 'user-1',
  createdAt: '2026-04-29T10:00:00.000Z',
  updatedAt: '2026-04-29T10:00:00.000Z',
};

describe('AgentBuilderAgentView MSW integration', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the real empty chat state from API data and autofills a starter prompt without submitting', async () => {
    let sendRequestCount = 0;
    server.use(
      http.get(`${BASE_URL}/api/stored/agents/agent-123`, () => HttpResponse.json(storedAgent)),
      http.get(`${BASE_URL}/api/memory/threads/agent-123/messages`, () => HttpResponse.json({ messages: [] })),
      http.post(`${BASE_URL}/api/agents/agent-123/stream`, () => {
        sendRequestCount += 1;
        return HttpResponse.json({});
      }),
    );

    renderPage();

    const emptyState = await screen.findByTestId('agent-builder-agent-chat-empty-state');
    expect(within(emptyState).getByText('MSW Agent')).toBeTruthy();
    expect(within(emptyState).getByText('Loaded from stored agent API')).toBeTruthy();
    expect(screen.getAllByTestId(/agent-builder-agent-chat-starter-/)).toHaveLength(4);

    fireEvent.click(screen.getByTestId('agent-builder-agent-chat-starter-what-can-you-do?'));

    const input = screen.getByTestId('agent-builder-agent-chat-input') as HTMLTextAreaElement;
    expect(input.value).toBe('What can you do? Give me a quick overview of your capabilities.');
    await waitFor(() => expect(sendRequestCount).toBe(0));
  });
});
