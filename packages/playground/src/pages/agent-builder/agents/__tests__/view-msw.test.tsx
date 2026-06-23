// @vitest-environment jsdom
import { TooltipProvider } from '@mastra/playground-ui';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, cleanup, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import AgentBuilderAgentView from '../view';
import { authDisabledCapabilities, builderSettingsDisabled, currentUser } from './fixtures/auth';
import { LinkComponentProvider } from '@/lib/framework';
import { server } from '@/test/msw-server';

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

/**
 * Auth/access handlers driving the real `useCurrentUser`, `usePermissions`,
 * and `useBuilderAgentAccess` / `useBuilderAgentFeatures` hooks:
 *   - GET /api/auth/me            → current user (ownership source of truth)
 *   - GET /api/auth/capabilities  → rbac disabled ⇒ canWrite/canExecute true
 *   - GET /api/editor/builder/settings → no agent features (panels stay hidden)
 */
const authHandlers = () => [
  http.get(`${BASE_URL}/api/auth/me`, () => HttpResponse.json(currentUser)),
  http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json(authDisabledCapabilities)),
  http.get(`${BASE_URL}/api/editor/builder/settings`, () => HttpResponse.json(builderSettingsDisabled)),
];

const emptyThread = () =>
  http.get(`${BASE_URL}/api/memory/threads/user-1-agent-123/messages`, () => HttpResponse.json({ messages: [] }));

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

  describe('when the agent loads with no chat history', () => {
    it('renders the empty chat state with the agent name and description from the API', async () => {
      server.use(
        ...authHandlers(),
        http.get(`${BASE_URL}/api/stored/agents/agent-123`, () => HttpResponse.json(storedAgent)),
        emptyThread(),
      );

      renderPage();

      const emptyState = await screen.findByTestId('agent-builder-agent-chat-empty-state');
      expect(within(emptyState).getByText('MSW Agent')).toBeTruthy();
      expect(within(emptyState).getByText('Loaded from stored agent API')).toBeTruthy();
    });

    it('offers four starter prompts', async () => {
      server.use(
        ...authHandlers(),
        http.get(`${BASE_URL}/api/stored/agents/agent-123`, () => HttpResponse.json(storedAgent)),
        emptyThread(),
      );

      renderPage();

      await screen.findByTestId('agent-builder-agent-chat-empty-state');
      expect(screen.getAllByTestId(/agent-builder-agent-chat-starter-/)).toHaveLength(4);
    });

    it('autofills the input from a starter prompt without submitting', async () => {
      let sendRequestCount = 0;
      server.use(
        ...authHandlers(),
        http.get(`${BASE_URL}/api/stored/agents/agent-123`, () => HttpResponse.json(storedAgent)),
        emptyThread(),
        http.post(`${BASE_URL}/api/agents/agent-123/stream`, () => {
          sendRequestCount += 1;
          return HttpResponse.json({});
        }),
      );

      renderPage();

      await screen.findByTestId('agent-builder-agent-chat-empty-state');
      fireEvent.click(screen.getByTestId('agent-builder-agent-chat-starter-what-can-you-do?'));

      const input = screen.getByTestId('agent-builder-agent-chat-input') as HTMLTextAreaElement;
      expect(input.value).toBe('What can you do? Give me a quick overview of your capabilities.');
      await waitFor(() => expect(sendRequestCount).toBe(0));
    });
  });

  describe('when the current user is not the owner of the agent', () => {
    it('hides the edit mode toggle', async () => {
      server.use(
        ...authHandlers(),
        http.get(`${BASE_URL}/api/stored/agents/agent-123`, () =>
          HttpResponse.json({ ...storedAgent, authorId: 'someone-else' }),
        ),
        emptyThread(),
      );

      renderPage();

      await screen.findByTestId('agent-builder-agent-chat-empty-state');
      expect(screen.queryByTestId('agent-builder-mode-toggle')).toBeNull();
    });

    it('hides both library visibility buttons', async () => {
      server.use(
        ...authHandlers(),
        http.get(`${BASE_URL}/api/stored/agents/agent-123`, () =>
          HttpResponse.json({ ...storedAgent, authorId: 'someone-else' }),
        ),
        emptyThread(),
      );

      renderPage();

      await screen.findByTestId('agent-builder-agent-chat-empty-state');
      expect(screen.queryByTestId('agent-builder-visibility-add')).toBeNull();
      expect(screen.queryByTestId('agent-builder-visibility-remove')).toBeNull();
    });
  });

  describe('when the owner views their own public agent', () => {
    it('never renders the library visibility button on the view page', async () => {
      server.use(
        ...authHandlers(),
        http.get(`${BASE_URL}/api/stored/agents/agent-123`, () => HttpResponse.json(storedAgent)),
        emptyThread(),
      );

      renderPage();

      await screen.findByTestId('agent-builder-agent-chat-empty-state');
      expect(screen.queryByTestId('agent-builder-visibility-add')).toBeNull();
      expect(screen.queryByTestId('agent-builder-visibility-remove')).toBeNull();
    });
  });

  describe('when rendering in view mode regardless of ownership', () => {
    it('never renders the configure panel', async () => {
      server.use(
        ...authHandlers(),
        http.get(`${BASE_URL}/api/stored/agents/agent-123`, () => HttpResponse.json(storedAgent)),
        emptyThread(),
      );

      renderPage();

      await screen.findByTestId('agent-builder-agent-chat-empty-state');
      expect(screen.queryByTestId('agent-builder-panel-configure')).toBeNull();
    });

    it('never renders the configure tab strip', async () => {
      server.use(
        ...authHandlers(),
        http.get(`${BASE_URL}/api/stored/agents/agent-123`, () => HttpResponse.json(storedAgent)),
        emptyThread(),
      );

      renderPage();

      await screen.findByTestId('agent-builder-agent-chat-empty-state');
      expect(screen.queryByTestId('agent-builder-tab-chat')).toBeNull();
      expect(screen.queryByTestId('agent-builder-tab-configure')).toBeNull();
    });
  });
});
