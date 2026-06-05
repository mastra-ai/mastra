// @vitest-environment jsdom
import type * as PlaygroundUi from '@mastra/playground-ui';
import { TooltipProvider } from '@mastra/playground-ui';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import AgentBuilderAgentOnboarding from '../onboarding';
import type * as AgentBuilderModule from '@/domains/agent-builder';
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

vi.mock('@/domains/agent-builder', async () => {
  const actual = await vi.importActual<typeof AgentBuilderModule>('@/domains/agent-builder');
  return {
    ...actual,
    useBuilderAgentFeatures: () => ({
      tools: false,
      memory: false,
      workflows: false,
      agents: false,
      skills: false,
      avatarUpload: false,
      model: false,
      favorites: false,
      browser: false,
    }),
  };
});

const useCurrentUserMock = vi.fn<() => { data: { id: string } | undefined; isLoading: boolean }>(() => ({
  data: { id: 'user-1' },
  isLoading: false,
}));
vi.mock('@/domains/auth/hooks/use-current-user', () => ({
  useCurrentUser: () => useCurrentUserMock(),
}));

const useBuilderAgentAccessMock = vi.fn(() => ({
  hasAccess: true,
  canWrite: true,
  canExecute: true,
  canManageSkills: true,
  canUseFavorites: true,
  denialReason: null,
}));
vi.mock('@/domains/agent-builder/hooks/use-builder-agent-access', () => ({
  useBuilderAgentAccess: () => useBuilderAgentAccessMock(),
}));

const useStreamRunningMock = vi.fn(() => false);
vi.mock('@/domains/agent-builder/contexts/stream-chat-context', () => ({
  useStreamRunning: () => useStreamRunningMock(),
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
            <MemoryRouter initialEntries={['/agent-builder/agents/agent-onboarding/onboarding']}>
              <Routes>
                <Route path="/agent-builder/agents/:id/onboarding" element={<AgentBuilderAgentOnboarding />} />
                <Route path="/agent-builder/agents/:id/edit" element={<div data-testid="edit-page" />} />
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

const draftAgent = {
  id: 'agent-onboarding',
  name: 'Freshly created',
  description: 'Created by the workflow',
  instructions: 'Be helpful.',
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

const baseHandlers = (agentResponse: () => Response = () => HttpResponse.json(draftAgent)) => [
  http.get(`${BASE_URL}/api/auth/capabilities`, () =>
    HttpResponse.json({
      enabled: true,
      login: null,
      user: { id: 'user-1' },
      capabilities: { user: true, session: true, sso: false, rbac: false, acl: false },
      access: null,
    }),
  ),
  http.get(`${BASE_URL}/api/stored/agents/agent-onboarding`, () => agentResponse()),
  http.get(`${BASE_URL}/api/stored/workspaces`, () => HttpResponse.json({ workspaces: [] })),
  http.get(`${BASE_URL}/api/channels/platforms`, () => HttpResponse.json([])),
  http.get(`${BASE_URL}/api/editor/builder/settings`, () => HttpResponse.json({})),
];

describe('AgentBuilderAgentOnboarding MSW integration', () => {
  beforeAll(() => {
    installRadixDomShims();
  });

  afterEach(() => {
    cleanup();
    useStreamRunningMock.mockReturnValue(false);
    useCurrentUserMock.mockReturnValue({ data: { id: 'user-1' }, isLoading: false });
    useBuilderAgentAccessMock.mockReturnValue({
      hasAccess: true,
      canWrite: true,
      canExecute: true,
      canManageSkills: true,
      canUseFavorites: true,
      denialReason: null,
    });
  });

  it('owner + draft agent: renders the centered wizard review without chat', async () => {
    server.use(...baseHandlers());

    renderPage();

    await screen.findByTestId('agent-builder-panel-profile');

    expect(screen.queryByTestId('agent-builder-panel-chat')).toBeNull();
    expect((screen.getByTestId('agent-configure-name') as HTMLInputElement).value).toBe('Freshly created');
    expect(screen.getByRole('button', { name: /continue/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /previous/i })).toBeNull();
  });

  it('walks from the initial review to the section review', async () => {
    server.use(...baseHandlers());

    renderPage();

    const continueCta = await screen.findByRole('button', { name: /continue/i });
    fireEvent.click(continueCta);

    await screen.findByRole('heading', { name: 'Instructions' });
    expect(screen.getByRole('button', { name: /previous/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /try agent/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /see agent configuration/i })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /previous/i }));
    await screen.findByTestId('agent-configure-name');
  });

  it('"Try agent" CTA navigates to /view from the last review step', async () => {
    server.use(...baseHandlers());

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /continue/i }));
    const viewCta = await screen.findByRole('button', { name: /try agent/i });
    fireEvent.click(viewCta);

    await screen.findByTestId('view-page');
  });

  it('"See agent configuration" CTA navigates to /edit from the last review step', async () => {
    server.use(...baseHandlers());

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /continue/i }));
    const editCta = await screen.findByRole('button', { name: /see agent configuration/i });
    fireEvent.click(editCta);

    await screen.findByTestId('edit-page');
  });

  it('wizard actions are disabled while the stream is running', async () => {
    useStreamRunningMock.mockReturnValue(true);
    server.use(...baseHandlers());

    renderPage();

    const continueCta = (await screen.findByRole('button', { name: /continue/i })) as HTMLButtonElement;
    expect(continueCta.disabled).toBe(true);

    fireEvent.click(continueCta);
    expect(screen.queryByRole('button', { name: /previous/i })).toBeNull();
  });

  it('missing agent: redirects to the agents list', async () => {
    server.use(...baseHandlers(() => new HttpResponse(null, { status: 404 })));

    renderPage();

    await screen.findByTestId('agents-list-page');
  });

  it('non-owner: redirects to /view', async () => {
    useCurrentUserMock.mockReturnValue({ data: { id: 'someone-else' }, isLoading: false });
    server.use(...baseHandlers(() => HttpResponse.json(draftAgent)));

    renderPage();

    await screen.findByTestId('view-page');
  });

  it('no write access: redirects to /view', async () => {
    useBuilderAgentAccessMock.mockReturnValue({
      hasAccess: true,
      canWrite: false,
      canExecute: true,
      canManageSkills: true,
      canUseFavorites: true,
      denialReason: null,
    });
    server.use(...baseHandlers());

    renderPage();

    await screen.findByTestId('view-page');
  });
});
