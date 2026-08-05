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
import { LinkComponentProvider } from '@/lib/framework';
import { server } from '@/test/msw-server';
vi.mock('@mastra/playground-ui/store/playground-store', () => ({
  usePlaygroundStore: () => ({ requestContext: undefined }),
}));

vi.mock('@mastra/playground-ui/utils/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// Stub heavy chat panels to keep this focused on the header.
vi.mock('@/domains/agent-builder/components/agent-edit/conversation-panel', () => ({
  ConversationPanelChat: () => <div data-testid="stub-conversation-panel" />,
  ConversationPanelProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const useStreamRunningMock = vi.fn(() => false);
vi.mock('@/domains/agent-builder/contexts/stream-chat-context', () => ({
  useStreamRunning: () => useStreamRunningMock(),
  // No debounce in these suites: they assert steady running/idle states, not the idle-gap
  // grace period (covered by edit-onboarding.msw.test.tsx with the real debounce hook).
  useStreamRunningDebounced: () => useStreamRunningMock(),
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
            <MemoryRouter initialEntries={['/agent-builder/agents/agent-123/edit']}>
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

const storedAgent = {
  id: 'agent-123',
  name: 'MSW Agent',
  description: 'Loaded from stored agent API',
  instructions: 'Do useful things',
  tools: [],
  agents: [],
  workflows: [],
  status: 'draft',
  visibility: 'private',
  model: { provider: 'openai', name: 'gpt-4' },
  authorId: 'user-1',
  createdAt: '2026-04-29T10:00:00.000Z',
  updatedAt: '2026-04-29T10:00:00.000Z',
};

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

const baseHandlers = (overrides?: Partial<typeof storedAgent>) => [
  // auth enabled (so the library visibility UI renders) but rbac off ⇒
  // useBuilderAgentAccess resolves canWrite/canExecute true.
  http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json(authEnabledNoRbacCapabilities)),
  // current user owns the agent (authorId === user-1) ⇒ owner-only header actions show.
  http.get(`${BASE_URL}/api/auth/me`, () => HttpResponse.json(currentUser)),
  http.get(`${BASE_URL}/api/stored/agents/agent-123`, () => HttpResponse.json({ ...storedAgent, ...overrides })),
  http.get(`${BASE_URL}/api/stored/agents/agent-123/dependents`, () =>
    HttpResponse.json({ agents: [], workflows: [] }),
  ),
  http.get(`${BASE_URL}/api/stored/workspaces`, () => HttpResponse.json({ workspaces: [] })),
  http.get(`${BASE_URL}/api/tool-providers`, () => HttpResponse.json({ providers: [] })),
  http.get(`${BASE_URL}/api/channels/platforms`, () => HttpResponse.json([])),
  http.get(`${BASE_URL}/api/editor/builder/settings`, () => HttpResponse.json({})),
];

describe('AgentBuilderAgentEdit MSW integration — visibility immediate-persist', () => {
  beforeAll(() => {
    installRadixDomShims();
  });

  afterEach(() => {
    cleanup();
    useStreamRunningMock.mockReturnValue(false);
  });

  it('keeps the Add to library button enabled while a stream is running', async () => {
    useStreamRunningMock.mockReturnValue(true);
    server.use(...baseHandlers());

    renderPage();

    const addButton = await screen.findByTestId('agent-builder-visibility-add', undefined, { timeout: 10_000 });
    expect(addButton.hasAttribute('disabled')).toBe(false);
    expect(addButton.getAttribute('data-disabled')).toBeNull();
    expect(addButton.textContent).toContain('Add to library');
  });

  it('confirming Add to library issues PATCH /api/stored/agents/:id with visibility=public', async () => {
    let capturedBody: any = null;
    server.use(
      ...baseHandlers(),
      http.patch(`${BASE_URL}/api/stored/agents/agent-123`, async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({ ...storedAgent, visibility: 'public' });
      }),
    );

    renderPage();

    const addButton = await screen.findByTestId('agent-builder-visibility-add', undefined, { timeout: 10_000 });
    fireEvent.click(addButton);

    fireEvent.click(await screen.findByTestId('agent-builder-visibility-confirm-yes'));

    await waitFor(() => {
      expect(capturedBody).toEqual({ visibility: 'public' });
    });
    await waitFor(() => {
      expect(screen.queryByTestId('agent-builder-visibility-confirm-dialog')).toBeNull();
    });
  });
});
