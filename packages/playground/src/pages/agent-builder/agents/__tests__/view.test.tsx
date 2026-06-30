import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import React from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import AgentBuilderAgentView from '../view';
import { authDisabledCapabilities, builderSettingsDisabled, currentUser } from './fixtures/auth';
import { LinkComponentProvider } from '@/lib/framework';
import { server } from '@/test/msw-server';
vi.mock('@mastra/playground-ui/store/playground-store', () => ({
  usePlaygroundStore: () => ({ requestContext: undefined }),
}));

vi.mock('@mastra/playground-ui/utils/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
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

/**
 * Auth/access handlers driving the real `useCurrentUser`, `usePermissions`,
 * `useBuilderAgentAccess`, and `useBuilderAgentFeatures` hooks:
 *   - GET /api/auth/me                 → current user (ownership source of truth)
 *   - GET /api/auth/capabilities       → rbac disabled ⇒ canWrite/canExecute true
 *   - GET /api/editor/builder/settings → no agent features (panels stay hidden)
 */
const authHandlers = () => [
  http.get(`${BASE_URL}/api/auth/me`, () => HttpResponse.json(currentUser)),
  http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json(authDisabledCapabilities)),
  http.get(`${BASE_URL}/api/editor/builder/settings`, () => HttpResponse.json(builderSettingsDisabled)),
];

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

const emptyThread = () =>
  http.get(`${BASE_URL}/api/memory/threads/user-1-agent-123/messages`, () => HttpResponse.json({ messages: [] }));

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

  describe('when the owner views their agent', () => {
    it('renders a mode-toggle button that navigates to the edit page when clicked', async () => {
      server.use(
        ...authHandlers(),
        http.get(`${BASE_URL}/api/stored/agents/agent-123`, () => HttpResponse.json(storedAgent)),
        emptyThread(),
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
        ...authHandlers(),
        http.get(`${BASE_URL}/api/stored/agents/agent-123`, ({ request }) => {
          draftRequests.push(new URL(request.url).search);
          return HttpResponse.json(storedAgent);
        }),
        emptyThread(),
      );

      renderPage();

      await screen.findByTestId('agent-builder-agent-chat-empty-state');
      expect(draftRequests.some(search => search.includes('status=draft'))).toBe(true);
    });
  });

  describe('when a non-owner views the agent', () => {
    it('does not render the configure panel or tabs', async () => {
      server.use(
        ...authHandlers(),
        http.get(`${BASE_URL}/api/stored/agents/agent-123`, () =>
          HttpResponse.json({ ...storedAgent, authorId: 'someone-else' }),
        ),
        emptyThread(),
      );

      renderPage();

      await screen.findByTestId('agent-builder-agent-chat-empty-state');
      expect(screen.queryByTestId('agent-builder-panel-configure')).toBeNull();
      expect(screen.queryByTestId('agent-builder-tab-chat')).toBeNull();
      expect(screen.queryByTestId('agent-builder-tab-configure')).toBeNull();
    });
  });

  describe('when the page renders its layout', () => {
    it('renders the view top bar above the chat panel', async () => {
      server.use(
        ...authHandlers(),
        http.get(`${BASE_URL}/api/stored/agents/agent-123`, () => HttpResponse.json(storedAgent)),
        emptyThread(),
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
});
