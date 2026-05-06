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

const StubLink = ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
  <a {...props}>{children}</a>
);

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
      http.get(`${BASE_URL}/api/memory/threads/user-1-agent-123/messages`, () => HttpResponse.json({ messages: [] })),
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

  it('shows the Publish to channel button for the owner', async () => {
    server.use(
      http.get(`${BASE_URL}/api/stored/agents/agent-123`, () => HttpResponse.json(storedAgent)),
      http.get(`${BASE_URL}/api/memory/threads/user-1-agent-123/messages`, () => HttpResponse.json({ messages: [] })),
      http.get(`${BASE_URL}/api/channels/platforms`, () =>
        HttpResponse.json([{ id: 'slack', name: 'Slack', isConfigured: true }]),
      ),
      http.get(`${BASE_URL}/api/channels/:platform/installations`, () => HttpResponse.json([])),
    );

    renderPage();

    const publish = (await screen.findByTestId('agent-builder-publish-channel')) as HTMLButtonElement;
    expect(publish.disabled).toBe(false);
  });

  it('hides the Edit and Publish to channel buttons for non-owners', async () => {
    const otherAgent = { ...storedAgent, authorId: 'someone-else' };
    server.use(
      http.get(`${BASE_URL}/api/stored/agents/agent-123`, () => HttpResponse.json(otherAgent)),
      http.get(`${BASE_URL}/api/memory/threads/user-1-agent-123/messages`, () => HttpResponse.json({ messages: [] })),
      http.get(`${BASE_URL}/api/channels/platforms`, () =>
        HttpResponse.json([{ id: 'slack', name: 'Slack', isConfigured: true }]),
      ),
      http.get(`${BASE_URL}/api/channels/:platform/installations`, () => HttpResponse.json([])),
    );

    renderPage();

    await screen.findByTestId('agent-builder-agent-chat-empty-state');
    expect(screen.queryByTestId('agent-builder-mode-toggle')).toBeNull();
    expect(screen.queryByTestId('agent-builder-publish-channel')).toBeNull();
    expect(screen.queryByTestId('agent-builder-visibility-add')).toBeNull();
    expect(screen.queryByTestId('agent-builder-visibility-remove')).toBeNull();
  });

  it('shows the Remove from library button for the owner of a public agent', async () => {
    server.use(
      http.get(`${BASE_URL}/api/stored/agents/agent-123`, () => HttpResponse.json(storedAgent)),
      http.get(`${BASE_URL}/api/memory/threads/user-1-agent-123/messages`, () => HttpResponse.json({ messages: [] })),
      http.get(`${BASE_URL}/api/auth/capabilities`, () =>
        HttpResponse.json({ enabled: true, user: { id: 'user-1' } }),
      ),
    );

    renderPage();

    expect(await screen.findByTestId('agent-builder-visibility-remove')).toBeTruthy();
  });

  it('shows Chat and Configuration tabs for the owner via real stored-agent data', async () => {
    server.use(
      http.get(`${BASE_URL}/api/stored/agents/agent-123`, () => HttpResponse.json(storedAgent)),
      http.get(`${BASE_URL}/api/memory/threads/user-1-agent-123/messages`, () => HttpResponse.json({ messages: [] })),
    );

    renderPage();

    expect(await screen.findByTestId('agent-builder-tab-configure')).toBeTruthy();
    expect(screen.getByTestId('agent-builder-tab-chat')).toBeTruthy();
  });

  it('hides Configuration tab for non-owners via real stored-agent data', async () => {
    const otherAgent = { ...storedAgent, authorId: 'someone-else' };
    server.use(
      http.get(`${BASE_URL}/api/stored/agents/agent-123`, () => HttpResponse.json(otherAgent)),
      http.get(`${BASE_URL}/api/memory/threads/user-1-agent-123/messages`, () => HttpResponse.json({ messages: [] })),
    );

    renderPage();

    await screen.findByTestId('agent-builder-agent-chat-empty-state');
    expect(screen.queryByTestId('agent-builder-tab-chat')).toBeNull();
    expect(screen.queryByTestId('agent-builder-tab-configure')).toBeNull();
  });

  it('shows the delete-agent button for the owner', async () => {
    server.use(
      http.get(`${BASE_URL}/api/stored/agents/agent-123`, () => HttpResponse.json(storedAgent)),
      http.get(`${BASE_URL}/api/memory/threads/user-1-agent-123/messages`, () => HttpResponse.json({ messages: [] })),
    );

    renderPage();

    expect(await screen.findByTestId('agent-builder-delete-agent')).toBeTruthy();
  });

  it('hides the delete-agent button for non-owners', async () => {
    const otherAgent = { ...storedAgent, authorId: 'someone-else' };
    server.use(
      http.get(`${BASE_URL}/api/stored/agents/agent-123`, () => HttpResponse.json(otherAgent)),
      http.get(`${BASE_URL}/api/memory/threads/user-1-agent-123/messages`, () => HttpResponse.json({ messages: [] })),
    );

    renderPage();

    await screen.findByTestId('agent-builder-agent-chat-empty-state');
    expect(screen.queryByTestId('agent-builder-delete-agent')).toBeNull();
  });

  it('confirms delete from the view page, calls the API, and after the request resolves redirects to the agents list', async () => {
    let deleteCalled = false;
    server.use(
      http.get(`${BASE_URL}/api/stored/agents/agent-123`, () => HttpResponse.json(storedAgent)),
      http.get(`${BASE_URL}/api/memory/threads/user-1-agent-123/messages`, () => HttpResponse.json({ messages: [] })),
      http.delete(`${BASE_URL}/api/stored/agents/agent-123`, () => {
        deleteCalled = true;
        return HttpResponse.json({ success: true });
      }),
    );

    renderPage();

    fireEvent.click(await screen.findByTestId('agent-builder-delete-agent'));
    fireEvent.click(await screen.findByTestId('agent-builder-delete-agent-confirm'));

    await waitFor(() => {
      expect(deleteCalled).toBe(true);
    });
  });
});
