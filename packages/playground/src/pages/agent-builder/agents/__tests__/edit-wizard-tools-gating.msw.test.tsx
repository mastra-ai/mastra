import type { GetAgentResponse, ListToolProvidersResponse } from '@mastra/client-js';
import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import AgentBuilderAgentEdit from '../edit';
import { authEnabledNoRbacCapabilities, currentUser } from './fixtures/auth';
import { emptyAgents, oneOtherAgent, settingsAgentsOnly } from './fixtures/builder';
import { LinkComponentProvider } from '@/lib/framework';
import { server } from '@/test/msw-server';
vi.mock('@mastra/playground-ui/store/playground-store', () => ({
  usePlaygroundStore: () => ({ requestContext: undefined }),
}));

vi.mock('@mastra/playground-ui/utils/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// Stub heavy chat panels so we can focus on the wizard step tree.
vi.mock('@/domains/agent-builder/components/agent-edit/conversation-panel', () => ({
  ConversationPanelChat: () => <div data-testid="stub-conversation-panel" />,
  ConversationPanelProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/domains/agent-builder/contexts/stream-chat-context', () => ({
  useStreamRunning: () => false,
  useStreamRunningDebounced: () => false,
  useStreamMessages: () => [],
  useStreamSend: () => () => {},
}));

vi.mock('@/domains/agent-builder/contexts/stream-chat-provider', () => ({
  StreamChatProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
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
            <MemoryRouter
              initialEntries={[
                { pathname: '/agent-builder/agents/agent-wizard/edit', state: { userMessage: 'hello' } },
              ]}
            >
              <Routes>
                <Route path="/agent-builder/agents/:id/edit" element={<AgentBuilderAgentEdit />} />
                <Route path="/agent-builder/agents/:id/view" element={<div data-testid="view-page" />} />
                <Route path="/agent-builder/agents" element={<div data-testid="agents-list-page" />} />
              </Routes>
            </MemoryRouter>
          </TooltipProvider>
        </LinkComponentProvider>
      </QueryClientProvider>
    </MastraReactProvider>,
  );
}

// Mandatory onboarding fields are filled so the split layout (and the per-step
// Continue CTA) renders. The model feature is off, so model.name is not mandatory.
const storedAgent = {
  id: 'agent-wizard',
  name: 'Wizard Agent',
  description: 'An agent for wizard gating tests',
  instructions: 'Be helpful.',
  tools: [],
  agents: [],
  workflows: [],
  status: 'draft',
  visibility: 'private',
  model: { provider: 'openai', name: 'gpt-5-mini' },
  authorId: 'user-1',
  createdAt: '2026-04-29T10:00:00.000Z',
  updatedAt: '2026-04-29T10:00:00.000Z',
};

const emptyToolProviders: ListToolProvidersResponse = { providers: [] };

const installRadixDomShims = () => {
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
  }
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false;
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = () => {};
  }
  if (typeof globalThis.ResizeObserver === 'undefined') {
    class StubResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    (globalThis as unknown as { ResizeObserver: typeof StubResizeObserver }).ResizeObserver = StubResizeObserver;
  }
};

const baseHandlers = (agents: Record<string, GetAgentResponse>) => [
  http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json(authEnabledNoRbacCapabilities)),
  http.get(`${BASE_URL}/api/auth/me`, () => HttpResponse.json(currentUser)),
  http.get(`${BASE_URL}/api/stored/agents/agent-wizard`, () => HttpResponse.json(storedAgent)),
  http.patch(`${BASE_URL}/api/stored/agents/agent-wizard`, async ({ request }) => {
    const body = (await request.json()) as Partial<typeof storedAgent>;
    return HttpResponse.json({ ...storedAgent, ...body });
  }),
  http.get(`${BASE_URL}/api/stored/workspaces`, () => HttpResponse.json({ workspaces: [] })),
  http.get(`${BASE_URL}/api/channels/platforms`, () => HttpResponse.json([])),
  http.get(`${BASE_URL}/api/editor/builder/settings`, () => HttpResponse.json(settingsAgentsOnly)),
  http.get(`${BASE_URL}/api/agents`, () => HttpResponse.json(agents)),
  http.get(`${BASE_URL}/api/tool-providers`, () => HttpResponse.json(emptyToolProviders)),
];

describe('AgentBuilderAgentEdit MSW integration — wizard tools-step gating', () => {
  beforeAll(() => {
    installRadixDomShims();
  });

  afterEach(() => {
    cleanup();
  });

  describe('when agents-only features are enabled and another agent is available', () => {
    it('includes the Tools step because sub-agents count as agent tools', async () => {
      server.use(...baseHandlers(oneOtherAgent));

      renderPage();

      // Split layout with the per-step Continue CTA (all mandatory fields filled).
      await waitFor(() => {
        expect(screen.queryByTestId('agent-builder-panel-profile')).not.toBeNull();
      });

      fireEvent.click(await screen.findByTestId('agent-builder-ready-review'));
      fireEvent.click(await screen.findByRole('button', { name: /continue/i }));

      expect(await screen.findByText('Available tools')).toBeTruthy();
    });
  });

  describe('when agents-only features are enabled but no agent tools exist', () => {
    it('skips the Tools step and lands on Instructions', async () => {
      server.use(...baseHandlers(emptyAgents));

      renderPage();

      await waitFor(() => {
        expect(screen.queryByTestId('agent-builder-panel-profile')).not.toBeNull();
      });

      fireEvent.click(await screen.findByTestId('agent-builder-ready-review'));
      fireEvent.click(await screen.findByRole('button', { name: /continue/i }));

      // Parity with the Tools tab, which is hidden without available tools.
      expect(await screen.findByText('Instructions')).toBeTruthy();
      expect(screen.queryByText('Available tools')).toBeNull();
    });
  });
});
