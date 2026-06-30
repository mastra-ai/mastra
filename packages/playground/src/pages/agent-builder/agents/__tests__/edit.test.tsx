import type { StoredAgentResponse } from '@mastra/client-js';
import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import React from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import AgentBuilderAgentEdit from '../edit';
import { authEnabledNoRbacCapabilities } from './fixtures/auth';
import {
  composioGmailConnections,
  composioGmailTools,
  composioProviderList,
  composioToolkits,
} from './fixtures/tool-providers';
import { LinkComponentProvider } from '@/lib/framework';
import { server } from '@/test/msw-server';
vi.mock('@mastra/playground-ui/store/playground-store', () => ({
  usePlaygroundStore: () => ({ requestContext: undefined }),
}));

vi.mock('@mastra/playground-ui/utils/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// Stub heavy chat panels to keep this focused on header/layout/redirect logic.
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

const LocationProbe = () => {
  const location = useLocation();
  return <div data-testid="current-location">{location.pathname}</div>;
};

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  const result = render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <LinkComponentProvider Link={StubLink as never} navigate={() => {}} paths={noopPaths}>
          <TooltipProvider>
            <MemoryRouter initialEntries={['/agent-builder/agents/agent-123/edit']}>
              <LocationProbe />
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
  return { ...result, queryClient };
}

const storedAgent: StoredAgentResponse = {
  id: 'agent-123',
  name: 'Existing',
  description: 'An existing agent',
  instructions: 'Do things',
  tools: {},
  agents: {},
  workflows: {},
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

const commonHandlers = (overrides?: { agent?: Partial<typeof storedAgent>; meDelay?: Promise<void> }) => [
  http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json(authEnabledNoRbacCapabilities)),
  http.get(`${BASE_URL}/api/auth/me`, async () => {
    if (overrides?.meDelay) await overrides.meDelay;
    return HttpResponse.json({ id: 'user-1' });
  }),
  http.get(`${BASE_URL}/api/stored/agents/agent-123`, () => HttpResponse.json({ ...storedAgent, ...overrides?.agent })),
  http.get(`${BASE_URL}/api/stored/agents/agent-123/dependents`, () =>
    HttpResponse.json({ dependents: [], hiddenCount: 0 }),
  ),
  http.get(`${BASE_URL}/api/stored/workspaces`, () => HttpResponse.json({ workspaces: [] })),
  http.get(`${BASE_URL}/api/channels/platforms`, () => HttpResponse.json([])),
  http.get(`${BASE_URL}/api/editor/builder/settings`, () => HttpResponse.json({})),
  http.get(`${BASE_URL}/api/tool-providers`, () => HttpResponse.json([])),
];

describe('AgentBuilderAgentEdit — navigation, header, autosave', () => {
  beforeAll(() => {
    installRadixDomShims();
  });

  afterEach(() => {
    cleanup();
  });

  it('redirects to the agents list when no stored agent exists (404)', async () => {
    server.use(
      http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json(authEnabledNoRbacCapabilities)),
      http.get(`${BASE_URL}/api/auth/me`, () => HttpResponse.json({ id: 'user-1' })),
      http.get(`${BASE_URL}/api/stored/agents/agent-123`, () => new HttpResponse(null, { status: 404 })),
      http.get(`${BASE_URL}/api/stored/workspaces`, () => HttpResponse.json({ workspaces: [] })),
      http.get(`${BASE_URL}/api/channels/platforms`, () => HttpResponse.json([])),
      http.get(`${BASE_URL}/api/editor/builder/settings`, () => HttpResponse.json({})),
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('agents-list-page')).not.toBeNull();
    });
    expect(screen.getByTestId('current-location').textContent).toBe('/agent-builder/agents');
  });

  it('does not render Cancel or Save buttons (autosaved)', async () => {
    server.use(...commonHandlers());
    renderPage();

    await screen.findByTestId('agent-builder-panel-chat');
    expect(screen.queryByTestId('agent-builder-edit-cancel')).toBeNull();
    expect(screen.queryByTestId('agent-builder-edit-save')).toBeNull();
  });

  it('renders an "Agent list" breadcrumb link pointing to the agents list', async () => {
    server.use(...commonHandlers());
    renderPage();

    const link = (await screen.findByRole('link', { name: /agent list/i })) as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/agent-builder/agents');
  });

  it('autosaves edits made in the configure panel and persists them via PATCH', async () => {
    const patchBodies: unknown[] = [];
    server.use(
      ...commonHandlers(),
      http.patch(`${BASE_URL}/api/stored/agents/agent-123`, async ({ request }) => {
        const body = await request.json();
        patchBodies.push(body);
        return HttpResponse.json({ ...storedAgent, ...(body as Partial<typeof storedAgent>) });
      }),
    );

    renderPage();

    const nameInput = await screen.findByTestId('agent-configure-name');
    fireEvent.change(nameInput, { target: { value: 'Updated name' } });
    fireEvent.change(screen.getByTestId('agent-configure-description'), {
      target: { value: 'Updated description' },
    });

    await waitFor(() => {
      expect(patchBodies.length).toBeGreaterThan(0);
    });

    const lastBody = patchBodies[patchBodies.length - 1] as Record<string, unknown>;
    expect(lastBody).toMatchObject({
      name: 'Updated name',
      description: 'Updated description',
    });

    // Stays on the edit page (autosave should not navigate to view).
    expect(screen.getByTestId('current-location').textContent).toBe('/agent-builder/agents/agent-123/edit');
  });

  it('does not autosave when integration provider tools finish loading', async () => {
    const patchAgent = vi.fn();
    const listToolkits = vi.fn();
    const listTools = vi.fn();
    const listConnections = vi.fn();

    server.use(
      http.get(`${BASE_URL}/api/tool-providers`, () => HttpResponse.json(composioProviderList)),
      ...commonHandlers({
        agent: {
          toolProviders: {
            composio: {
              tools: {
                GMAIL_FETCH_EMAILS: { toolkit: 'gmail', description: 'Fetch emails from Gmail' },
              },
              connections: {
                gmail: [{ kind: 'author', toolkit: 'gmail', connectionId: 'conn-gmail', scope: 'per-author' }],
              },
            },
          },
        },
      }),
      http.get(`${BASE_URL}/api/tool-providers/composio/toolkits`, () => {
        listToolkits();
        return HttpResponse.json(composioToolkits);
      }),
      http.get(`${BASE_URL}/api/tool-providers/composio/tools`, () => {
        listTools();
        return HttpResponse.json(composioGmailTools);
      }),
      http.get(`${BASE_URL}/api/tool-providers/composio/connections`, () => {
        listConnections();
        return HttpResponse.json(composioGmailConnections);
      }),
      http.patch(`${BASE_URL}/api/stored/agents/agent-123`, async ({ request }) => {
        patchAgent(await request.json());
        return HttpResponse.json(storedAgent);
      }),
    );

    renderPage();

    await screen.findByTestId('agent-configure-name');
    await waitFor(() => expect(listToolkits).toHaveBeenCalled());
    await waitFor(() => expect(listTools).toHaveBeenCalled());
    await waitFor(() => expect(listConnections).toHaveBeenCalled());
    // Autosave debounce is 600ms (use-autosave-agent); wait well past it so a
    // wrongly-triggered autosave would reliably fire before this assertion.
    await new Promise(resolve => setTimeout(resolve, 1000));

    expect(patchAgent).not.toHaveBeenCalled();
  });

  it('requests the latest draft so freshly saved edits appear', async () => {
    const draftRequests: string[] = [];
    server.use(
      http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json(authEnabledNoRbacCapabilities)),
      http.get(`${BASE_URL}/api/auth/me`, () => HttpResponse.json({ id: 'user-1' })),
      http.get(`${BASE_URL}/api/stored/agents/agent-123`, ({ request }) => {
        draftRequests.push(new URL(request.url).search);
        return HttpResponse.json(storedAgent);
      }),
      http.get(`${BASE_URL}/api/stored/agents/agent-123/dependents`, () =>
        HttpResponse.json({ dependents: [], hiddenCount: 0 }),
      ),
      http.get(`${BASE_URL}/api/stored/workspaces`, () => HttpResponse.json({ workspaces: [] })),
      http.get(`${BASE_URL}/api/channels/platforms`, () => HttpResponse.json([])),
      http.get(`${BASE_URL}/api/editor/builder/settings`, () => HttpResponse.json({})),
      http.get(`${BASE_URL}/api/tool-providers`, () => HttpResponse.json([])),
    );

    renderPage();

    await screen.findByTestId('agent-configure-name');
    expect(draftRequests.some(search => search.includes('status=draft'))).toBe(true);
  });

  it('waits for the current user before redirecting an owned agent', async () => {
    let resolveMe: () => void = () => {};
    const meDelay = new Promise<void>(resolve => {
      resolveMe = resolve;
    });

    server.use(...commonHandlers({ agent: { authorId: 'user-1' }, meDelay }));

    const { queryClient } = renderPage();

    // While the current user (`/api/auth/me`) is still loading, the other
    // queries settle. Wait for builder-settings to resolve so the loading
    // window is genuinely reached (and the late provider update lands inside
    // act) before asserting that no redirect has happened yet.
    await waitFor(() => {
      expect(queryClient.getQueryState(['builder-settings'])?.status).toBe('success');
    });
    expect(screen.getByTestId('current-location').textContent).toBe('/agent-builder/agents/agent-123/edit');
    expect(screen.queryByTestId('view-page')).toBeNull();
    expect(screen.queryByTestId('agents-list-page')).toBeNull();

    resolveMe();

    await waitFor(() => {
      // Owner edit page stays on /edit once the user resolves.
      expect(screen.getByTestId('current-location').textContent).toBe('/agent-builder/agents/agent-123/edit');
    });
  });

  it('renders the profile panel alongside the chat without a tab strip', async () => {
    server.use(...commonHandlers());
    renderPage();

    expect(await screen.findByTestId('agent-configure-name')).not.toBeNull();
    expect(screen.getByTestId('agent-builder-panel-chat')).not.toBeNull();
    expect(screen.getByTestId('agent-builder-panel-profile')).not.toBeNull();
    expect(screen.queryByTestId('agent-builder-tab-chat')).toBeNull();
    expect(screen.queryByTestId('agent-builder-tab-configure')).toBeNull();
  });

  it('renders the Delete agent button and DELETEs + redirects on confirm', async () => {
    let deleteCount = 0;
    server.use(
      ...commonHandlers(),
      http.delete(`${BASE_URL}/api/stored/agents/agent-123`, () => {
        deleteCount += 1;
        return HttpResponse.json({ success: true });
      }),
    );

    renderPage();

    const deleteButton = await screen.findByTestId('agent-builder-delete-agent');
    fireEvent.click(deleteButton);

    const confirm = await screen.findByTestId('agent-builder-delete-agent-confirm');
    await waitFor(() => expect((confirm as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(confirm);

    await waitFor(() => expect(deleteCount).toBe(1));
    await waitFor(() => {
      expect(screen.getByTestId('agents-list-page')).not.toBeNull();
    });
    expect(screen.getByTestId('current-location').textContent).toBe('/agent-builder/agents');
  });

  it('redirects non-owners to the view page after the current user loads', async () => {
    server.use(...commonHandlers({ agent: { authorId: 'another-user' } }));

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('view-page')).not.toBeNull();
    });
    expect(screen.getByTestId('current-location').textContent).toBe('/agent-builder/agents/agent-123/view');
  });
});
