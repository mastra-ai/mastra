// @vitest-environment jsdom
import type * as PlaygroundUi from '@mastra/playground-ui';
import { TooltipProvider } from '@mastra/playground-ui';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import AgentBuilderAgentEdit from '../edit';
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

// Stub heavy chat panels so we can focus on layout.
vi.mock('@/domains/agent-builder/components/agent-edit/conversation-panel', () => ({
  ConversationPanelChat: () => <div data-testid="stub-conversation-panel" />,
  ConversationPanelProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
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

// Drive the starter message so the wizard begins in the 'initial' step.
const useStarterUserMessageMock = vi.fn<() => string | undefined>(() => 'hello');
vi.mock('@/domains/agent-builder/hooks/use-starter-user-message', () => ({
  useStarterUserMessage: () => useStarterUserMessageMock(),
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
            <MemoryRouter initialEntries={['/agent-builder/agents/agent-onboarding/edit']}>
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

const emptyAgent = {
  id: 'agent-onboarding',
  name: '',
  description: '',
  instructions: '',
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

const populatedAgent = {
  ...emptyAgent,
  id: 'agent-onboarding',
  name: 'Pre-populated',
  description: 'A pre-populated description',
  instructions: 'Be helpful.',
};

const halfPopulatedAgent = {
  ...emptyAgent,
  id: 'agent-onboarding',
  name: 'Has name',
  description: 'Has description',
  // instructions intentionally empty: still a mandatory field for onboarding completion.
  instructions: '',
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

const baseHandlers = (agent: typeof emptyAgent) => [
  http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json({ enabled: true, user: { id: 'user-1' } })),
  http.get(`${BASE_URL}/api/stored/agents/agent-onboarding`, () => HttpResponse.json(agent)),
  http.patch(`${BASE_URL}/api/stored/agents/agent-onboarding`, async ({ request }) => {
    const body = (await request.json()) as Partial<typeof emptyAgent>;
    return HttpResponse.json({ ...agent, ...body });
  }),
  http.get(`${BASE_URL}/api/stored/workspaces`, () => HttpResponse.json({ workspaces: [] })),
  http.get(`${BASE_URL}/api/channels/platforms`, () => HttpResponse.json([])),
  http.get(`${BASE_URL}/api/editor/builder/settings`, () => HttpResponse.json({})),
];

describe('AgentBuilderAgentEdit MSW integration — initial onboarding layout', () => {
  beforeAll(() => {
    installRadixDomShims();
  });

  afterEach(() => {
    cleanup();
    useStreamRunningMock.mockReturnValue(false);
    useStarterUserMessageMock.mockReturnValue('hello');
  });

  it('initial onboarding: shows only the centered chat panel — no profile column and no inline name/description inputs', async () => {
    server.use(...baseHandlers(emptyAgent));

    renderPage();

    // Chat panel renders (centered variant).
    await screen.findByTestId('agent-builder-panel-chat');

    // Profile column is not in the DOM during onboarding.
    expect(screen.queryByTestId('agent-builder-panel-profile')).toBeNull();

    // Name/description inputs must NOT be rendered above (or alongside) the chat during onboarding.
    expect(screen.queryByTestId('agent-configure-name')).toBeNull();
    expect(screen.queryByTestId('agent-configure-description')).toBeNull();
  });

  it('non-initial step: renders the split layout with chat and profile side by side', async () => {
    // No starter message → wizard starts at 'end', not 'initial'.
    useStarterUserMessageMock.mockReturnValue(undefined);
    server.use(...baseHandlers(populatedAgent));

    renderPage();

    await waitFor(() => {
      expect(screen.queryByTestId('agent-builder-panel-chat')).not.toBeNull();
      expect(screen.queryByTestId('agent-builder-panel-profile')).not.toBeNull();
    });
  });

  it('initial step but agent already has all mandatory fields: renders split layout immediately', async () => {
    server.use(...baseHandlers(populatedAgent));

    renderPage();

    await waitFor(() => {
      expect(screen.queryByTestId('agent-builder-panel-chat')).not.toBeNull();
      expect(screen.queryByTestId('agent-builder-panel-profile')).not.toBeNull();
    });
  });

  it('initial step with only some mandatory fields filled (missing instructions): stays centered', async () => {
    server.use(...baseHandlers(halfPopulatedAgent));

    renderPage();

    await screen.findByTestId('agent-builder-panel-chat');
    expect(screen.queryByTestId('agent-builder-panel-profile')).toBeNull();
  });

  it('on the last user-facing step: renders "See agent configuration" + "Try agent" CTAs instead of "Continue"', async () => {
    server.use(...baseHandlers(populatedAgent));

    renderPage();

    // Wait for the profile column to mount (split layout, all mandatory fields filled).
    await waitFor(() => {
      expect(screen.queryByTestId('agent-builder-panel-profile')).not.toBeNull();
    });

    // Wizard starts on 'initial'. Advance to 'instructions' (the last user-facing step
    // with all features off → tree is: initial > instructions > end).
    const continueButton = await screen.findByRole('button', { name: /continue/i });
    fireEvent.click(continueButton);

    // On the last step, the single Continue button is replaced by two CTAs.
    const seeConfigButton = await screen.findByRole('button', { name: /see agent configuration/i });
    const tryAgentButton = screen.getByRole('button', { name: /try agent/i });
    expect(seeConfigButton).toBeTruthy();
    expect(tryAgentButton).toBeTruthy();
    expect(screen.queryByRole('button', { name: /continue/i })).toBeNull();
  });

  it('on the last step: "Try agent" navigates to /view', async () => {
    server.use(...baseHandlers(populatedAgent));

    renderPage();

    await waitFor(() => {
      expect(screen.queryByTestId('agent-builder-panel-profile')).not.toBeNull();
    });

    fireEvent.click(await screen.findByRole('button', { name: /continue/i }));

    const tryAgentButton = await screen.findByRole('button', { name: /try agent/i });
    fireEvent.click(tryAgentButton);

    // Route changed to /view → the harness mounts a stub element with this testid.
    await screen.findByTestId('view-page');
  });

  it('on the last step: "See agent configuration" advances the wizard to end and shows the full profile', async () => {
    server.use(...baseHandlers(populatedAgent));

    renderPage();

    await waitFor(() => {
      expect(screen.queryByTestId('agent-builder-panel-profile')).not.toBeNull();
    });

    fireEvent.click(await screen.findByRole('button', { name: /continue/i }));

    const seeConfigButton = await screen.findByRole('button', { name: /see agent configuration/i });
    fireEvent.click(seeConfigButton);

    // After advancing past the last user-facing step, the per-step CTAs disappear
    // (the wizard renders the default AgentProfile hero+tabs branch on `end`).
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /see agent configuration/i })).toBeNull();
      expect(screen.queryByRole('button', { name: /try agent/i })).toBeNull();
    });

    // Still on the edit route (no navigation away).
    expect(screen.queryByTestId('view-page')).toBeNull();
  });

  it('initial step with all mandatory fields and not streaming: renders the two mobile CTAs', async () => {
    server.use(...baseHandlers(populatedAgent));

    renderPage();

    await waitFor(() => {
      expect(screen.queryByTestId('agent-builder-panel-profile')).not.toBeNull();
    });

    expect(screen.getByTestId('agent-builder-mobile-initial-cta-chat')).toBeTruthy();
    expect(screen.getByTestId('agent-builder-mobile-initial-cta-config')).toBeTruthy();
  });

  it('initial step while streaming: does not render the mobile CTAs', async () => {
    useStreamRunningMock.mockReturnValue(true);
    server.use(...baseHandlers(populatedAgent));

    renderPage();

    await waitFor(() => {
      expect(screen.queryByTestId('agent-builder-panel-profile')).not.toBeNull();
    });

    expect(screen.queryByTestId('agent-builder-mobile-initial-cta-chat')).toBeNull();
    expect(screen.queryByTestId('agent-builder-mobile-initial-cta-config')).toBeNull();
  });

  it('initial step with missing mandatory fields: does not render the mobile CTAs', async () => {
    server.use(...baseHandlers(halfPopulatedAgent));

    renderPage();

    await screen.findByTestId('agent-builder-panel-chat');

    expect(screen.queryByTestId('agent-builder-mobile-initial-cta-chat')).toBeNull();
    expect(screen.queryByTestId('agent-builder-mobile-initial-cta-config')).toBeNull();
  });

  it('mobile initial CTA "Chat with my agent" navigates to /view', async () => {
    server.use(...baseHandlers(populatedAgent));

    renderPage();

    const chatCta = await screen.findByTestId('agent-builder-mobile-initial-cta-chat');
    fireEvent.click(chatCta);

    await screen.findByTestId('view-page');
  });

  it('mobile initial CTA "See configuration" advances the wizard out of the initial step', async () => {
    server.use(...baseHandlers(populatedAgent));

    renderPage();

    const configCta = await screen.findByTestId('agent-builder-mobile-initial-cta-config');
    fireEvent.click(configCta);

    // After advancing, the mobile initial CTAs disappear (step is no longer 'initial').
    await waitFor(() => {
      expect(screen.queryByTestId('agent-builder-mobile-initial-cta-chat')).toBeNull();
      expect(screen.queryByTestId('agent-builder-mobile-initial-cta-config')).toBeNull();
    });
  });

  it('on the end step: the chat column is hidden on mobile via "hidden lg:block" classes', async () => {
    // No starter message → wizard starts at 'end'.
    useStarterUserMessageMock.mockReturnValue(undefined);
    server.use(...baseHandlers(populatedAgent));

    renderPage();

    const chatPanel = await screen.findByTestId('agent-builder-panel-chat');
    expect(chatPanel.classList.contains('hidden')).toBe(true);
    expect(chatPanel.classList.contains('lg:block')).toBe(true);

    // Profile is still rendered.
    expect(screen.getByTestId('agent-builder-panel-profile')).toBeTruthy();
  });

  it('on the initial step: the chat column is NOT hidden on mobile', async () => {
    server.use(...baseHandlers(populatedAgent));

    renderPage();

    const chatPanel = await screen.findByTestId('agent-builder-panel-chat');
    expect(chatPanel.classList.contains('hidden')).toBe(false);
  });

  it('on the end step: hero actions (Delete + Add to library) are wrapped in a mobile-hidden container', async () => {
    // No starter message → wizard starts at 'end' (the step where hero actions render).
    useStarterUserMessageMock.mockReturnValue(undefined);
    server.use(...baseHandlers(populatedAgent));

    renderPage();

    const heroActionsWrapper = await screen.findByTestId('agent-builder-hero-actions-desktop');
    expect(heroActionsWrapper.classList.contains('hidden')).toBe(true);
    expect(heroActionsWrapper.classList.contains('lg:flex')).toBe(true);

    // Confirm the delete button is a child of the mobile-hidden wrapper (not a sibling).
    await waitFor(() => {
      expect(heroActionsWrapper.querySelector('[data-testid="agent-builder-delete-agent"]')).not.toBeNull();
    });
  });
});
