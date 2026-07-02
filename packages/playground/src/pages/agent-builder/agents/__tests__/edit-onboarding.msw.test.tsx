import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import AgentBuilderAgentEdit from '../edit';
import {
  authCapabilities,
  buildBuilderSettings,
  currentUser,
} from '@/domains/agent-builder/components/agent-edit/agent-profile/__tests__/fixtures/builder';
import { useDebouncedRunning } from '@/domains/agent-builder/hooks/use-debounced-running';
import { LinkComponentProvider } from '@/lib/framework';
import { server } from '@/test/msw-server';
vi.mock('@mastra/playground-ui/store/playground-store', () => ({
  usePlaygroundStore: () => ({ requestContext: undefined }),
}));

vi.mock('@mastra/playground-ui/utils/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// Stub heavy chat panels so we can focus on layout.
vi.mock('@/domains/agent-builder/components/agent-edit/conversation-panel', () => ({
  ConversationPanelChat: () => <div data-testid="stub-conversation-panel" />,
  ConversationPanelProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const useStreamRunningMock = vi.fn(() => false);
vi.mock('@/domains/agent-builder/contexts/stream-chat-context', () => ({
  useStreamRunning: () => useStreamRunningMock(),
  // Delegates to the real (unmocked) debounce hook so the idle-gap grace
  // period stays under test; only the running flag itself is stubbed.
  useStreamRunningDebounced: () => useDebouncedRunning(useStreamRunningMock()),
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

// The wizard begins in the 'ready' step when a starter prompt is forwarded via
// router location state (read by the real `useStarterUserMessage` hook).
function renderPage(starterMessage: string | null = 'hello') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  const initialEntries = [
    starterMessage === null
      ? { pathname: '/agent-builder/agents/agent-onboarding/edit', state: null }
      : {
          pathname: '/agent-builder/agents/agent-onboarding/edit',
          state: { userMessage: starterMessage },
        },
  ];

  // Build a fresh element each call so view.rerender(makeTree()) produces a new
  // element identity (forcing React to re-read the useStreamRunning mock) while
  // reusing the same QueryClient/router instances (no remount, no lost state).
  const makeTree = () => (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <LinkComponentProvider Link={StubLink as never} navigate={() => {}} paths={noopPaths}>
          <TooltipProvider>
            <MemoryRouter initialEntries={initialEntries}>
              <Routes>
                <Route path="/agent-builder/agents/:id/edit" element={<AgentBuilderAgentEdit />} />
                <Route path="/agent-builder/agents/:id/view" element={<div data-testid="view-page" />} />
                <Route path="/agent-builder/agents" element={<div data-testid="agents-list-page" />} />
              </Routes>
            </MemoryRouter>
          </TooltipProvider>
        </LinkComponentProvider>
      </QueryClientProvider>
    </MastraReactProvider>
  );

  const result = render(makeTree());
  return { ...result, makeTree };
}

type RenderResult = ReturnType<typeof renderPage>;

// Simulate the builder agent's auto-run on the `ready` entry finishing: while it
// composes the agent the stream is running (isRunning true); when it completes the
// stream goes idle (isRunning false). The "Your agent is ready" review panel only
// appears once the mandatory fields are populated AND the stream is idle, so the
// caller must render a populated agent fixture for the panel to reveal.
async function simulateBuilderRun(view: RenderResult) {
  // Let the page finish its initial load (gate resolves, layout mounts) first.
  await screen.findByTestId('agent-builder-panel-chat');

  await act(async () => {
    useStreamRunningMock.mockReturnValue(true);
    view.rerender(view.makeTree());
  });
  await act(async () => {
    useStreamRunningMock.mockReturnValue(false);
    view.rerender(view.makeTree());
  });
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
  http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json(authCapabilities)),
  http.get(`${BASE_URL}/api/auth/me`, () => HttpResponse.json(currentUser)),
  http.get(`${BASE_URL}/api/stored/agents/agent-onboarding`, () => HttpResponse.json(agent)),
  http.patch(`${BASE_URL}/api/stored/agents/agent-onboarding`, async ({ request }) => {
    const body = (await request.json()) as Partial<typeof emptyAgent>;
    return HttpResponse.json({ ...agent, ...body });
  }),
  http.get(`${BASE_URL}/api/stored/agents/agent-onboarding/dependents`, () =>
    HttpResponse.json({ dependents: [], hiddenCount: 0 }),
  ),
  http.get(`${BASE_URL}/api/stored/workspaces`, () => HttpResponse.json({ workspaces: [] })),
  http.get(`${BASE_URL}/api/channels/platforms`, () => HttpResponse.json([])),
  // Empty provider list short-circuits the integration tool fan-out.
  http.get(`${BASE_URL}/api/tool-providers`, () => HttpResponse.json({ providers: [] })),
  // All agent features off: the onboarding wizard resolves its minimal tree.
  http.get(`${BASE_URL}/api/editor/builder/settings`, () => HttpResponse.json(buildBuilderSettings())),
];

// Helper: drive the builder auto-run to completion so the 'ready' entry reveals
// its review panel, then click "Review my agent" to advance into the 'identity'
// (name/description) step that begins the step-by-step flow. Requires a populated
// agent so the identity step has its mandatory fields.
async function advanceFromReadyToIdentity(view: RenderResult) {
  await simulateBuilderRun(view);
  const reviewButton = await screen.findByTestId('agent-builder-ready-review');
  fireEvent.click(reviewButton);
}

describe('AgentBuilderAgentEdit MSW integration — initial onboarding layout', () => {
  beforeAll(() => {
    installRadixDomShims();
  });

  afterEach(() => {
    cleanup();
    useStreamRunningMock.mockReturnValue(false);
  });

  it('ready entry while the builder is still composing (no mandatory fields yet): stays centered (chat only, no review panel)', async () => {
    // The agent that the builder is still writing has no mandatory fields yet. We
    // key the centered chat off that same derived "is the agent composed" signal,
    // so the chat stays centered and the "Your agent is ready" review panel is
    // hidden until the agent has been composed.
    server.use(...baseHandlers(emptyAgent));

    renderPage();

    await screen.findByTestId('agent-builder-panel-chat');
    expect(screen.queryByTestId('agent-builder-panel-profile')).toBeNull();
    expect(screen.queryByTestId('agent-builder-ready-heading')).toBeNull();
  });

  it('ready entry once the builder run has finished: shows the review panel in the split layout', async () => {
    // The review panel only appears after the builder agent's auto-run completes
    // (isRunning true -> false), not merely because the stored agent has fields.
    // Once the run finishes the agent is "ready": chat on the left, "Your agent is
    // ready" review panel on the right.
    server.use(...baseHandlers(populatedAgent));

    const view = renderPage();
    await simulateBuilderRun(view);

    await screen.findByTestId('agent-builder-ready-heading');
    expect(screen.getByTestId('agent-builder-ready-review')).toBeTruthy();
    expect(screen.getByTestId('agent-builder-ready-try')).toBeTruthy();

    // Both columns are present: chat on the left, profile (review panel) on the right.
    expect(screen.getByTestId('agent-builder-panel-chat')).toBeTruthy();
    expect(screen.getByTestId('agent-builder-panel-profile')).toBeTruthy();

    // The ready screen does not expose name/description inputs (those belong to identity).
    expect(screen.queryByTestId('agent-configure-name')).toBeNull();
    expect(screen.queryByTestId('agent-configure-description')).toBeNull();

    // During onboarding the "Switch to View mode" toggle is hidden — the agent
    // is still being composed, so view mode makes no sense yet.
    expect(screen.queryByTestId('agent-builder-mode-toggle')).toBeNull();
  });

  it('ready entry while the builder is still running: keeps the review panel hidden even with mandatory fields', async () => {
    // While the builder's initial run is streaming (isRunning true) the entry stays
    // centered and the "Your agent is ready" panel is hidden, even though the agent
    // has acquired its mandatory fields. The panel only reveals once the run is idle.
    server.use(...baseHandlers(populatedAgent));
    useStreamRunningMock.mockReturnValue(true);

    renderPage();

    await screen.findByTestId('agent-builder-panel-chat');
    expect(screen.queryByTestId('agent-builder-panel-profile')).toBeNull();
    expect(screen.queryByTestId('agent-builder-ready-heading')).toBeNull();
  });

  it('ready entry: a brief mid-conversation idle gap does not reveal the review panel (no flicker)', async () => {
    // The stream flag can momentarily drop to false between builder runs. Once the
    // stream has been running for a while, a short idle gap must NOT flash the
    // review panel in and out — only a sustained idle (>3s debounce) reveals it.
    server.use(...baseHandlers(populatedAgent));

    const view = renderPage();
    await screen.findByTestId('agent-builder-panel-chat');

    await act(async () => {
      useStreamRunningMock.mockReturnValue(true);
      view.rerender(view.makeTree());
    });
    // Hold the stream running long enough for the debounced running flag to latch.
    await act(async () => new Promise(resolve => setTimeout(resolve, 3100)));

    // Brief idle gap: the flag drops, the next run starts shortly after.
    await act(async () => {
      useStreamRunningMock.mockReturnValue(false);
      view.rerender(view.makeTree());
    });
    await act(async () => new Promise(resolve => setTimeout(resolve, 200)));
    expect(screen.queryByTestId('agent-builder-ready-heading')).toBeNull();

    await act(async () => {
      useStreamRunningMock.mockReturnValue(true);
      view.rerender(view.makeTree());
    });
    expect(screen.queryByTestId('agent-builder-ready-heading')).toBeNull();

    // Once the stream is genuinely idle, the panel reveals after the debounce settles.
    await act(async () => {
      useStreamRunningMock.mockReturnValue(false);
      view.rerender(view.makeTree());
    });
    await screen.findByTestId('agent-builder-ready-heading', undefined, { timeout: 5000 });
  }, 15000);

  it('ready entry: "Try my agent" navigates to /view', async () => {
    server.use(...baseHandlers(populatedAgent));

    const view = renderPage();
    await simulateBuilderRun(view);

    fireEvent.click(await screen.findByTestId('agent-builder-ready-try'));

    await screen.findByTestId('view-page');
  });

  it('ready entry: "Review my agent" advances to the identity (name/description) step', async () => {
    // Use a populated agent so the review panel is revealed and the identity step
    // renders the split layout with the name/description editor.
    server.use(...baseHandlers(populatedAgent));

    const view = renderPage();
    await advanceFromReadyToIdentity(view);

    // Identity step renders the name/description editor in the profile column.
    await screen.findByTestId('agent-configure-name');
    expect(screen.getByTestId('agent-configure-description')).toBeTruthy();
  });

  it('non-initial step: renders the split layout with chat and profile side by side', async () => {
    // No starter message → wizard starts at 'end', not the onboarding entry.
    server.use(...baseHandlers(populatedAgent));

    renderPage(null);

    await waitFor(() => {
      expect(screen.queryByTestId('agent-builder-panel-chat')).not.toBeNull();
      expect(screen.queryByTestId('agent-builder-panel-profile')).not.toBeNull();
    });

    // Outside onboarding (wizard at `end`) the mode toggle is available again.
    expect(screen.getByTestId('agent-builder-mode-toggle')).toBeTruthy();
  });

  it('identity step with all mandatory fields filled: renders the split layout', async () => {
    server.use(...baseHandlers(populatedAgent));

    const view = renderPage();

    // Advance from the ready entry review panel into the identity step.
    await advanceFromReadyToIdentity(view);

    await waitFor(() => {
      expect(screen.queryByTestId('agent-builder-panel-chat')).not.toBeNull();
      expect(screen.queryByTestId('agent-builder-panel-profile')).not.toBeNull();
    });
  });

  it('ready entry with a half-composed agent (missing instructions): stays centered, no review panel', async () => {
    // The review panel requires every mandatory field. A half-composed agent (here
    // missing instructions) keeps the entry centered and never reveals the panel,
    // even once the stream is idle.
    server.use(...baseHandlers(halfPopulatedAgent));

    const view = renderPage();
    await simulateBuilderRun(view);

    expect(screen.queryByTestId('agent-builder-panel-profile')).toBeNull();
    expect(screen.queryByTestId('agent-builder-ready-review')).toBeNull();
  });

  it('on the last user-facing step: renders "See agent configuration" + "Try agent" CTAs instead of "Continue"', async () => {
    server.use(...baseHandlers(populatedAgent));

    const view = renderPage();

    // Advance from the centered ready entry into the step-by-step flow.
    await advanceFromReadyToIdentity(view);

    // Wait for the profile column to mount (split layout, all mandatory fields filled).
    await waitFor(() => {
      expect(screen.queryByTestId('agent-builder-panel-profile')).not.toBeNull();
    });

    // With all features off + no channels the onboarding tree is:
    // ready > identity > instructions > library > end. Advance identity → instructions → library.
    fireEvent.click(await screen.findByRole('button', { name: /continue/i }));
    fireEvent.click(await screen.findByRole('button', { name: /continue/i }));

    // On the last step ('library'), the single Continue button is replaced by two CTAs.
    const seeConfigButton = await screen.findByRole('button', { name: /see agent configuration/i });
    const tryAgentButton = screen.getByRole('button', { name: /try agent/i });
    expect(seeConfigButton).toBeTruthy();
    expect(tryAgentButton).toBeTruthy();
    expect(screen.queryByRole('button', { name: /continue/i })).toBeNull();
  });

  it('on the last step: "Try agent" navigates to /view', async () => {
    server.use(...baseHandlers(populatedAgent));

    const view = renderPage();
    await advanceFromReadyToIdentity(view);

    await waitFor(() => {
      expect(screen.queryByTestId('agent-builder-panel-profile')).not.toBeNull();
    });

    // identity → instructions → library (last step).
    fireEvent.click(await screen.findByRole('button', { name: /continue/i }));
    fireEvent.click(await screen.findByRole('button', { name: /continue/i }));

    const tryAgentButton = await screen.findByRole('button', { name: /try agent/i });
    fireEvent.click(tryAgentButton);

    // Route changed to /view → the harness mounts a stub element with this testid.
    await screen.findByTestId('view-page');
  });

  it('on the last step: "See agent configuration" advances the wizard to end and shows the full profile', async () => {
    server.use(...baseHandlers(populatedAgent));

    const view = renderPage();
    await advanceFromReadyToIdentity(view);

    await waitFor(() => {
      expect(screen.queryByTestId('agent-builder-panel-profile')).not.toBeNull();
    });

    // identity → instructions → library (last step).
    fireEvent.click(await screen.findByRole('button', { name: /continue/i }));
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

  it('identity step with all mandatory fields and not streaming: renders the two mobile CTAs', async () => {
    server.use(...baseHandlers(populatedAgent));

    const view = renderPage();
    await advanceFromReadyToIdentity(view);

    await waitFor(() => {
      expect(screen.queryByTestId('agent-builder-panel-profile')).not.toBeNull();
    });

    expect(screen.getByTestId('agent-builder-mobile-initial-cta-chat')).toBeTruthy();
    expect(screen.getByTestId('agent-builder-mobile-initial-cta-config')).toBeTruthy();
  });

  it('mobile initial CTA "Chat with my agent" navigates to /view', async () => {
    server.use(...baseHandlers(populatedAgent));

    const view = renderPage();
    await advanceFromReadyToIdentity(view);

    const chatCta = await screen.findByTestId('agent-builder-mobile-initial-cta-chat');
    fireEvent.click(chatCta);

    await screen.findByTestId('view-page');
  });

  it('mobile initial CTA "See configuration" advances the wizard out of the identity step', async () => {
    server.use(...baseHandlers(populatedAgent));

    const view = renderPage();
    await advanceFromReadyToIdentity(view);

    const configCta = await screen.findByTestId('agent-builder-mobile-initial-cta-config');
    fireEvent.click(configCta);

    // After advancing, the mobile initial CTAs disappear (step is no longer 'identity').
    await waitFor(() => {
      expect(screen.queryByTestId('agent-builder-mobile-initial-cta-chat')).toBeNull();
      expect(screen.queryByTestId('agent-builder-mobile-initial-cta-config')).toBeNull();
    });
  });

  it('on the end step: the chat column is hidden on mobile via "hidden lg:block" classes', async () => {
    // No starter message → wizard starts at 'end'.
    server.use(...baseHandlers(populatedAgent));

    renderPage(null);

    const chatPanel = await screen.findByTestId('agent-builder-panel-chat');
    expect(chatPanel.classList.contains('hidden')).toBe(true);
    expect(chatPanel.classList.contains('lg:block')).toBe(true);

    // Profile is still rendered.
    expect(screen.getByTestId('agent-builder-panel-profile')).toBeTruthy();
  });

  it('on the ready entry step: the chat column is NOT hidden on mobile', async () => {
    server.use(...baseHandlers(populatedAgent));

    renderPage();

    const chatPanel = await screen.findByTestId('agent-builder-panel-chat');
    expect(chatPanel.classList.contains('hidden')).toBe(false);
  });

  it('on the end step: hero actions (Delete + Add to library) are wrapped in a mobile-hidden container', async () => {
    // No starter message → wizard starts at 'end' (the step where hero actions render).
    server.use(...baseHandlers(populatedAgent));

    renderPage(null);

    const heroActionsWrapper = await screen.findByTestId('agent-builder-hero-actions-desktop');
    expect(heroActionsWrapper.classList.contains('hidden')).toBe(true);
    expect(heroActionsWrapper.classList.contains('lg:flex')).toBe(true);

    // Confirm the delete button is a child of the mobile-hidden wrapper (not a sibling).
    await waitFor(() => {
      expect(heroActionsWrapper.querySelector('[data-testid="agent-builder-delete-agent"]')).not.toBeNull();
    });
  });
});
