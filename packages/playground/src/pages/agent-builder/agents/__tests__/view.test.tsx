// @vitest-environment jsdom
import type * as PlaygroundUi from '@mastra/playground-ui';
import { TooltipProvider } from '@mastra/playground-ui';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import React from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
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

vi.mock('@/domains/agent-builder/hooks/use-builder-agent-access', () => ({
  useBuilderAgentAccess: () => ({
    hasAccess: true,
    canWrite: true,
    canExecute: true,
    canManageSkills: true,
    canUseFavorites: true,
    denialReason: null,
  }),
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

const LocationProbe = () => {
  const location = useLocation();
  return <div data-testid="current-location">{location.pathname}</div>;
};

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
              <LocationProbe />
              <Routes>
                <Route path="/agent-builder/agents/:id/view" element={<AgentBuilderAgentView />} />
                <Route path="/agent-builder/agents/:id/edit" element={<div data-testid="edit-page" />} />
              </Routes>
            </MemoryRouter>
          </TooltipProvider>
        </LinkComponentProvider>
      </QueryClientProvider>
    </MastraReactProvider>,
  );
}

const commonHandlers = () => [http.get(`${BASE_URL}/api/editor/builder/settings`, () => HttpResponse.json({}))];

const storedAgent = {
  id: 'agent-123',
  name: 'View Page Agent',
  description: 'Loaded from stored agent API',
  instructions: 'Do things',
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

describe('AgentBuilderAgentView — navigation and layout', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders a mode-toggle button for the owner that navigates to the edit page when clicked', async () => {
    server.use(
      ...commonHandlers(),
      http.get(`${BASE_URL}/api/stored/agents/agent-123`, () => HttpResponse.json(storedAgent)),
      http.get(`${BASE_URL}/api/memory/threads/user-1-agent-123/messages`, () => HttpResponse.json({ messages: [] })),
    );

    renderPage();

    const button = await screen.findByTestId('agent-builder-mode-toggle');
    expect(button.getAttribute('aria-label')).toBe('Switch to Edit mode');

    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByTestId('edit-page')).not.toBeNull();
    });
    expect(screen.getByTestId('current-location').textContent).toBe('/agent-builder/agents/agent-123/edit');
  });

  it('requests the latest draft so freshly saved edits appear', async () => {
    const draftRequests: string[] = [];
    server.use(
      ...commonHandlers(),
      http.get(`${BASE_URL}/api/stored/agents/agent-123`, ({ request }) => {
        draftRequests.push(new URL(request.url).search);
        return HttpResponse.json(storedAgent);
      }),
      http.get(`${BASE_URL}/api/memory/threads/user-1-agent-123/messages`, () => HttpResponse.json({ messages: [] })),
    );

    renderPage();

    await screen.findByTestId('agent-builder-agent-chat-empty-state');
    expect(draftRequests.some(search => search.includes('status=draft'))).toBe(true);
  });

  it('does not render the configure panel or tabs for non-owners either', async () => {
    server.use(
      ...commonHandlers(),
      http.get(`${BASE_URL}/api/stored/agents/agent-123`, () =>
        HttpResponse.json({ ...storedAgent, authorId: 'someone-else' }),
      ),
      http.get(`${BASE_URL}/api/memory/threads/user-1-agent-123/messages`, () => HttpResponse.json({ messages: [] })),
    );

    renderPage();

    await screen.findByTestId('agent-builder-agent-chat-empty-state');
    expect(screen.queryByTestId('agent-builder-panel-configure')).toBeNull();
    expect(screen.queryByTestId('agent-builder-tab-chat')).toBeNull();
    expect(screen.queryByTestId('agent-builder-tab-configure')).toBeNull();
  });

  it('renders the view top bar above the chat panel within the view layout', async () => {
    server.use(
      ...commonHandlers(),
      http.get(`${BASE_URL}/api/stored/agents/agent-123`, () => HttpResponse.json(storedAgent)),
      http.get(`${BASE_URL}/api/memory/threads/user-1-agent-123/messages`, () => HttpResponse.json({ messages: [] })),
    );

    renderPage();

    const topBar = await screen.findByTestId('agent-builder-view-top-bar');
    const chatPanel = await screen.findByTestId('agent-builder-panel-chat');
    expect(topBar).not.toBeNull();
    expect(chatPanel).not.toBeNull();
    const position = topBar.compareDocumentPosition(chatPanel);
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
