// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createContext, useContext, useEffect, useImperativeHandle, useState } from 'react';
import type { ReactNode, Ref } from 'react';
import { createMemoryRouter, Outlet, RouterProvider, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import AgentSession from '../session';
import AgentThread from '../thread';
import {
  preferenceModelProviders,
  memoryConfig,
  workingMemory,
  voiceSpeakers,
  mcpServers,
  preferenceThread,
} from './fixtures/thread-preferences';
import { emptyHistory, liveChunks, staleHistory } from './fixtures/thread-recovery';
import { AgentLayout } from '@/domains/agents/agent-layout';
import { emptyThreadTracesList } from '@/domains/traces/components/__tests__/fixtures/thread-traces';
import { agentIndexLoader, agentThreadsIndexLoader, legacyAgentChatLoader, paths } from '@/lib/app-routing';
import { LinkComponentProvider } from '@/lib/framework';
import { Link } from '@/lib/link';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
const AGENT_ID = 'chef-agent';
const THREAD_ID = 'thread-1';
// Live output travels through a real SSE stream (subscribe → parse → useChat merge)
// and is then paced word by word by the markdown reveal buffer, which replays when
// the message row remounts. Both are far slower than a JSON fetch when the whole
// suite runs in parallel, so those assertions get more than waitFor's 1s default.
const SSE_TIMEOUT = { timeout: 5000 };

// jsdom has no layout, so react-resizable-panels never resizes anything and
// `collapse()`/`expand()` are silently ignored. Replace Group/Panel with a
// deterministic stand-in that keeps sizes in React state, fires `onResize`,
// and reports the layout to the Group so the real `useDefaultLayout` still
// persists it. Everything else (usePanelRef, useDefaultLayout) is the real lib.
vi.mock('react-resizable-panels', async () => {
  const actual = await vi.importActual<typeof import('react-resizable-panels')>('react-resizable-panels');

  type PanelSize = { inPixels: number; asPercentage: number };
  type Handle = {
    collapse: () => void;
    expand: () => void;
    resize: (size: string | number) => void;
    getSize: () => PanelSize;
    isCollapsed: () => boolean;
  };

  const LayoutContext = createContext<{ report: (id: string, size: number) => void }>({ report: () => {} });
  const toNumber = (size: string | number | undefined, fallback: number) =>
    size === undefined ? fallback : typeof size === 'number' ? size : Number.parseFloat(size);

  const Group = ({
    className,
    children,
    onLayoutChange,
  }: {
    className?: string;
    children: ReactNode;
    onLayoutChange?: (layout: Record<string, number>) => void;
  }) => {
    const [layout, setLayout] = useState<Record<string, number>>({});
    const report = (id: string, size: number) =>
      setLayout(prev => (prev[id] === size ? prev : { ...prev, [id]: size }));

    useEffect(() => {
      if (Object.keys(layout).length > 0) onLayoutChange?.(layout);
    }, [layout, onLayoutChange]);

    return (
      <LayoutContext.Provider value={{ report }}>
        <div data-testid="panel-group" className={className}>
          {children}
        </div>
      </LayoutContext.Provider>
    );
  };

  const Panel = ({
    id,
    className,
    children,
    panelRef,
    defaultSize,
    collapsedSize,
    onResize,
    style,
  }: {
    id?: string;
    className?: string;
    children?: ReactNode;
    panelRef?: Ref<Handle>;
    defaultSize?: string | number;
    collapsedSize?: number;
    onResize?: (size: PanelSize, prev: PanelSize | undefined, id: string) => void;
    style?: React.CSSProperties;
  }) => {
    const { report } = useContext(LayoutContext);
    const expandedSize = toNumber(defaultSize, 300);
    const [size, setSize] = useState(expandedSize);

    useImperativeHandle(panelRef, () => ({
      collapse: () => setSize(collapsedSize ?? 0),
      expand: () => setSize(expandedSize),
      resize: next => setSize(toNumber(next, expandedSize)),
      getSize: () => ({ inPixels: size, asPercentage: size }),
      isCollapsed: () => size <= (collapsedSize ?? 0),
    }));

    useEffect(() => {
      onResize?.({ inPixels: size, asPercentage: size }, undefined, id ?? '');
      if (id) report(id, size);
      // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to size changes
    }, [size]);

    return (
      <section data-testid={`panel-${id}`} className={className} style={style}>
        {children}
      </section>
    );
  };

  const Separator = () => <div data-testid="panel-separator" />;

  return { ...actual, Group, Panel, Separator };
});

// CollapsiblePanel keeps its content mounted but marks the wrapper `hidden` once
// collapsed, so "gone" means an ancestor carries the hidden attribute.
const isHiddenFromUser = (element: HTMLElement) => element.closest('[hidden]') !== null;

const LocationProbe = () => {
  const location = useLocation();
  return <div data-testid="location-probe">{`${location.pathname}${location.search}`}</div>;
};

const buildRouter = (initialEntry: string) =>
  createMemoryRouter(
    [
      { path: '/agents', element: <LocationProbe /> },
      {
        // Mirrors App.tsx: the thread page is a child of the agent tabs layout.
        path: '/agents/:agentId',
        element: (
          <>
            <LocationProbe />
            <AgentLayout>
              <Outlet />
            </AgentLayout>
          </>
        ),
        children: [
          { index: true, loader: agentIndexLoader },
          { path: 'chat', loader: legacyAgentChatLoader },
          { path: 'chat/:threadId', loader: legacyAgentChatLoader },
          { path: 'threads', loader: agentThreadsIndexLoader },
          { path: 'threads/:threadId', element: <AgentThread /> },
          { path: 'session/:threadId', element: <AgentSession /> },
        ],
      },
    ],
    { initialEntries: [initialEntry] },
  );

const renderAt = (
  initialEntry: string,
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  }),
) => {
  const router = buildRouter(initialEntry);

  render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <LinkComponentProvider Link={Link} navigate={to => void router.navigate(to)} paths={paths}>
          <RouterProvider router={router} />
        </LinkComponentProvider>
      </QueryClientProvider>
    </MastraReactProvider>,
  );

  return router;
};

const agentResponse = {
  id: AGENT_ID,
  name: 'Chef Agent',
  instructions: 'cook things',
  tools: {},
  workflows: {},
  provider: 'openai',
  modelId: 'gpt-5-mini',
  modelVersion: 'v2',
  supportsMemory: true,
  defaultOptions: {},
};

const threadsResponse = {
  threads: [
    {
      id: THREAD_ID,
      resourceId: AGENT_ID,
      title: 'Pasta night',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'thread-2',
      resourceId: AGENT_ID,
      title: 'Sushi ideas',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],
};

const onTracesRequest = vi.fn<(threadId: string | null) => void>();

function installHandlers() {
  const emptyTraces = ({ request }: { request: Request }) => {
    onTracesRequest(new URL(request.url).searchParams.get('threadId'));
    return HttpResponse.json(emptyThreadTracesList);
  };
  server.use(
    http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json({ enabled: false })),
    http.get(`${BASE_URL}/api/agents/${AGENT_ID}`, () => HttpResponse.json(agentResponse)),
    http.get(`${BASE_URL}/api/memory/status`, () => HttpResponse.json({ result: true, memoryType: 'local' })),
    http.get(`${BASE_URL}/api/memory/threads`, () => HttpResponse.json(threadsResponse)),
    http.get(`${BASE_URL}/api/memory/threads/:threadId/messages`, () =>
      HttpResponse.json({
        messages: [
          {
            id: 'msg-1',
            role: 'assistant',
            type: 'text',
            createdAt: new Date().toISOString(),
            content: { format: 2, parts: [{ type: 'text', text: 'Tonight we cook carbonara.' }] },
          },
        ],
      }),
    ),
    http.get(`${BASE_URL}/api/observability/traces/light`, emptyTraces),
    http.get(`${BASE_URL}/api/observability/traces`, emptyTraces),
    http.get(`${BASE_URL}/api/agents/providers`, () =>
      HttpResponse.json({
        providers: [
          { id: 'openai', name: 'OpenAI', envVar: 'OPENAI_API_KEY', connected: true, models: ['gpt-5-mini'] },
        ],
      }),
    ),
    http.get(`${BASE_URL}/api/editor/builder/settings`, () =>
      HttpResponse.json({ enabled: false, modelPolicy: { active: false } }),
    ),
    http.get(`${BASE_URL}/api/editor/builder/models/available`, () => HttpResponse.json({ providers: [] })),
    http.get(`${BASE_URL}/api/system/packages`, () => HttpResponse.json({})),
  );
}

afterEach(() => {
  cleanup();
  onTracesRequest.mockClear();
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe('Standalone thread page', () => {
  describe('when a history response arrives after live output', () => {
    it.each([
      { name: 'empty', history: emptyHistory },
      { name: 'stale', history: staleHistory },
    ])('preserves the streamed response with $name history', async ({ history }) => {
      installHandlers();
      let releaseHistory = () => {};
      const gate = new Promise<void>(resolve => {
        releaseHistory = resolve;
      });
      let push: (() => void) | undefined;
      let close = () => {};
      const historyReturned = vi.fn();
      server.use(
        http.get(`${BASE_URL}/api/agents/${AGENT_ID}/voice/speakers`, () => HttpResponse.json([])),
        http.get(`${BASE_URL}/api/memory/config`, () => HttpResponse.json({ config: {} })),
        http.get(`${BASE_URL}/api/memory/threads/:threadId/working-memory`, () =>
          HttpResponse.json({ workingMemory: null }),
        ),
        http.get(`${BASE_URL}/api/memory/threads/:threadId`, () => HttpResponse.json(threadsResponse.threads[0])),
        http.get(`${BASE_URL}/api/mcp/v0/servers`, () => HttpResponse.json({ servers: [] })),
        http.get(`${BASE_URL}/api/memory/threads/:threadId/messages`, async () => {
          await gate;
          historyReturned();
          return HttpResponse.json(history);
        }),
        http.post(
          `${BASE_URL}/api/agents/${AGENT_ID}/threads/subscribe`,
          () =>
            new HttpResponse(
              new ReadableStream<Uint8Array>({
                start(controller) {
                  close = () => controller.close();
                  push = () => {
                    for (const chunk of liveChunks)
                      controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(chunk)}\n\n`));
                  };
                },
              }),
              { headers: { 'Content-Type': 'text/event-stream' } },
            ),
        ),
      );
      const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      renderAt(`/agents/${AGENT_ID}/threads/${THREAD_ID}`, queryClient);
      try {
        await screen.findByText('OpenAI');
        await waitFor(() => expect(push).toBeDefined());
        await act(async () => push?.());
        await waitFor(() => expect(document.body.textContent).toContain('Live response survives'), SSE_TIMEOUT);
        // Live messages take precedence over the history skeleton.
        expect(screen.queryByTestId('thread-history-skeleton')).toBeNull();
        await act(async () => releaseHistory());
        await waitFor(() =>
          expect(queryClient.getQueryState(['memory', 'messages', THREAD_ID, AGENT_ID, {}])?.status).toBe('success'),
        );
        expect(historyReturned).toHaveBeenCalledOnce();
        await waitFor(
          () => expect(document.body.textContent?.split('Live response survives')).toHaveLength(2),
          SSE_TIMEOUT,
        );
        expect(document.body.textContent).not.toContain('Old partial output');
        if (history.messages.length) expect(document.body.textContent).toContain('Earlier prompt');
      } finally {
        releaseHistory();
        close();
      }
    });
  });

  describe('when opening an existing thread whose history is still loading', () => {
    it('shows the history skeleton, then the messages once history resolves', async () => {
      installHandlers();
      let releaseHistory = () => {};
      const gate = new Promise<void>(resolve => {
        releaseHistory = resolve;
      });
      server.use(
        http.get(`${BASE_URL}/api/memory/threads/:threadId/messages`, async () => {
          await gate;
          return HttpResponse.json(staleHistory);
        }),
      );
      renderAt(`/agents/${AGENT_ID}/threads/${THREAD_ID}`);
      try {
        expect(await screen.findByTestId('thread-history-skeleton')).not.toBeNull();
        expect(screen.queryByText('How can I help you today?')).toBeNull();

        await act(async () => releaseHistory());

        expect(await screen.findByText('Earlier prompt')).not.toBeNull();
        expect(screen.queryByTestId('thread-history-skeleton')).toBeNull();
      } finally {
        releaseHistory();
      }
    });
  });

  describe('when opening a new thread', () => {
    it('shows the welcome screen immediately without a skeleton', async () => {
      installHandlers();
      const messagesRequested = vi.fn();
      server.use(
        http.get(`${BASE_URL}/api/memory/threads/:threadId/messages`, () => {
          messagesRequested();
          return HttpResponse.json(emptyHistory);
        }),
      );
      renderAt(`/agents/${AGENT_ID}/threads/new`);

      expect(await screen.findByText('How can I help you today?')).not.toBeNull();
      expect(screen.queryByTestId('thread-history-skeleton')).toBeNull();
      expect(messagesRequested).not.toHaveBeenCalled();
    });
  });

  describe('when the agent has memory disabled', () => {
    it('shows the welcome screen immediately without a skeleton', async () => {
      installHandlers();
      const messagesRequested = vi.fn();
      server.use(
        http.get(`${BASE_URL}/api/memory/status`, () => HttpResponse.json({ result: false })),
        http.get(`${BASE_URL}/api/memory/threads/:threadId/messages`, () => {
          messagesRequested();
          return HttpResponse.json(emptyHistory);
        }),
      );
      renderAt(`/agents/${AGENT_ID}/threads/${THREAD_ID}`);

      expect(await screen.findByText('How can I help you today?')).not.toBeNull();
      expect(screen.queryByTestId('thread-history-skeleton')).toBeNull();
      expect(messagesRequested).not.toHaveBeenCalled();
    });
  });

  describe('when a first signal message is accepted', () => {
    it.each(['stay', 'navigate', 'reload'] as const)(
      'preserves thread identity and navigation when the user chooses to %s',
      async action => {
        installHandlers();
        const sent = vi.fn();
        let release = () => {};
        const gate = new Promise<void>(resolve => {
          release = resolve;
        });
        const acknowledged = vi.fn();
        const refreshedAfterAck = vi.fn();
        const ids: string[] = [];
        const closes: Array<() => void> = [];
        server.use(
          http.get(`${BASE_URL}/api/memory/threads`, () => {
            if (acknowledged.mock.calls.length) refreshedAfterAck();
            return HttpResponse.json(threadsResponse);
          }),
          http.get(`${BASE_URL}/api/agents/${AGENT_ID}/voice/speakers`, () => HttpResponse.json([])),
          http.get(`${BASE_URL}/api/memory/config`, () => HttpResponse.json({ config: {} })),
          http.get(`${BASE_URL}/api/memory/threads/:threadId/working-memory`, () =>
            HttpResponse.json({ workingMemory: null }),
          ),
          http.get(`${BASE_URL}/api/memory/threads/:threadId`, () => HttpResponse.json(threadsResponse.threads[0])),
          http.get(`${BASE_URL}/api/mcp/v0/servers`, () => HttpResponse.json({ servers: [] })),
          http.get(`${BASE_URL}/api/memory/threads/:threadId/messages`, () => HttpResponse.json(emptyHistory)),
          http.post(`${BASE_URL}/api/agents/${AGENT_ID}/send-message`, async ({ request }) => {
            sent(await request.json());
            await gate;
            acknowledged();
            return HttpResponse.json({ accepted: true, runId: 'recovery-run' });
          }),
          http.post(`${BASE_URL}/api/agents/${AGENT_ID}/threads/subscribe`, async ({ request }) => {
            const body: unknown = await request.json();
            if (body && typeof body === 'object' && 'threadId' in body && typeof body.threadId === 'string')
              ids.push(body.threadId);
            return new HttpResponse(
              new ReadableStream<Uint8Array>({
                start(controller) {
                  closes.push(() => controller.close());
                  if (action === 'reload' && ids.length > 1) {
                    for (const chunk of liveChunks)
                      controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(chunk)}\n\n`));
                  }
                },
              }),
              { headers: { 'Content-Type': 'text/event-stream' } },
            );
          }),
        );
        const router = renderAt(`/agents/${AGENT_ID}/threads/new`);
        try {
          await waitFor(() => expect(ids.length).toBeGreaterThan(0));
          const input = await screen.findByRole('textbox');
          fireEvent.change(input, { target: { value: 'Keep this conversation' } });
          fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
          await waitFor(() => expect(sent).toHaveBeenCalledOnce());
          if (action === 'navigate') await act(() => router.navigate(`/agents/${AGENT_ID}/threads/${THREAD_ID}`));
          await act(async () => release());
          await waitFor(() => expect(refreshedAfterAck).toHaveBeenCalled());
          if (action === 'navigate') {
            expect(router.state.location.pathname).toBe(`/agents/${AGENT_ID}/threads/${THREAD_ID}`);
          } else {
            await waitFor(() => expect(router.state.location.pathname).toBe(`/agents/${AGENT_ID}/threads/${ids[0]}`));
            expect(router.state.historyAction).toBe('REPLACE');
            expect(document.body.textContent).toContain('Keep this conversation');
            if (action === 'reload') {
              const savedPath = router.state.location.pathname;
              cleanup();
              renderAt(savedPath);
              await waitFor(() => expect(ids).toHaveLength(2));
              await waitFor(() => expect(document.body.textContent).toContain('Live response survives'), SSE_TIMEOUT);
            }
            expect(new Set(ids).size).toBe(1);
          }
        } finally {
          release();
          for (const close of closes) close();
        }
      },
    );
  });
  it('shows the thread conversation at /agents/:agentId/threads/:threadId', async () => {
    installHandlers();
    renderAt(`/agents/${AGENT_ID}/threads/${THREAD_ID}`);

    expect(await screen.findByText('Tonight we cook carbonara.')).not.toBeNull();
  });

  it('renders the composer model switcher with the agent model', async () => {
    installHandlers();
    renderAt(`/agents/${AGENT_ID}/threads/${THREAD_ID}`);

    await screen.findByText('Tonight we cook carbonara.');
    // Provider + model pill (needs PlaygroundModelProvider, which this page must supply itself).
    expect(await screen.findByText('OpenAI')).not.toBeNull();
    expect(await screen.findByText('gpt-5-mini')).not.toBeNull();
    expect(await screen.findByTestId('composer-model-settings-trigger')).not.toBeNull();
  });

  it('shows the thread list next to the chat', async () => {
    installHandlers();
    renderAt(`/agents/${AGENT_ID}/threads/${THREAD_ID}`);

    await screen.findByText('Tonight we cook carbonara.');
    expect(await screen.findByText('Sushi ideas')).not.toBeNull();
  });

  it('lets the user hide the threads panel and bring it back from the page edge', async () => {
    installHandlers();
    renderAt(`/agents/${AGENT_ID}/threads/${THREAD_ID}`);

    // Given the thread list is visible next to the chat
    await screen.findByText('Sushi ideas');
    expect(screen.queryByRole('button', { name: 'Expand panel' })).toBeNull();

    // When I hide the threads panel
    fireEvent.click(screen.getByRole('button', { name: 'Hide threads panel' }));

    // Then the list is gone and only the restore affordance remains
    await waitFor(() => expect(isHiddenFromUser(screen.getByText('Sushi ideas'))).toBe(true));
    expect(screen.queryByRole('button', { name: 'Hide threads panel' })).toBeNull();

    // And the collapsed state is remembered for this agent
    await waitFor(() => {
      const layout = window.localStorage.getItem(`react-resizable-panels:agent-layout-v6-${AGENT_ID}`);
      expect(layout).not.toBeNull();
      expect(JSON.parse(layout!)['left-slot']).toBe(0);
    });

    // When I expand it again from the page edge
    fireEvent.click(await screen.findByRole('button', { name: 'Expand panel' }));

    // Then the thread list is back
    await waitFor(() => expect(isHiddenFromUser(screen.getByText('Sushi ideas'))).toBe(false));
    expect(screen.getByRole('button', { name: 'Hide threads panel' })).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Expand panel' })).toBeNull();
  });

  it('does not carry a hidden threads panel over to another agent', async () => {
    installHandlers();
    const OTHER_AGENT_ID = 'sommelier-agent';
    server.use(
      http.get(`${BASE_URL}/api/agents/${OTHER_AGENT_ID}`, () =>
        HttpResponse.json({ ...agentResponse, id: OTHER_AGENT_ID, name: 'Sommelier Agent' }),
      ),
      http.get(`${BASE_URL}/api/memory/threads`, ({ request }) => {
        const agentId = new URL(request.url).searchParams.get('agentId');
        if (agentId === OTHER_AGENT_ID) {
          return HttpResponse.json({
            threads: [
              {
                id: 'wine-1',
                resourceId: OTHER_AGENT_ID,
                title: 'Wine pairing',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
            ],
          });
        }
        return HttpResponse.json(threadsResponse);
      }),
    );
    const router = renderAt(`/agents/${AGENT_ID}/threads/${THREAD_ID}`);

    // Given I hid the threads panel for the first agent
    await screen.findByText('Sushi ideas');
    fireEvent.click(screen.getByRole('button', { name: 'Hide threads panel' }));
    await screen.findByRole('button', { name: 'Expand panel' });

    // When I switch to another agent without leaving the page
    await act(() => router.navigate(`/agents/${OTHER_AGENT_ID}/threads/new`));

    // Then its threads panel is visible and its own layout is not marked collapsed
    const otherThread = await screen.findByText('Wine pairing');
    await waitFor(() => expect(isHiddenFromUser(otherThread)).toBe(false));
    expect(screen.getByRole('button', { name: 'Hide threads panel' })).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Expand panel' })).toBeNull();
    const otherLayout = window.localStorage.getItem(`react-resizable-panels:agent-layout-v6-${OTHER_AGENT_ID}`);
    expect(otherLayout === null || JSON.parse(otherLayout)['left-slot'] !== 0).toBe(true);
  });

  describe('when the thread list is still loading', () => {
    it('shows a compact skeleton in the sidebar, replaced by the threads once loaded', async () => {
      installHandlers();
      let releaseThreads!: () => void;
      const gate = new Promise<void>(resolve => (releaseThreads = resolve));
      server.use(
        http.get(`${BASE_URL}/api/memory/threads`, async () => {
          await gate;
          return HttpResponse.json(threadsResponse);
        }),
      );

      renderAt(`/agents/${AGENT_ID}/threads/${THREAD_ID}`);

      expect(await screen.findByTestId('agent-route-sidebar-skeleton')).not.toBeNull();

      releaseThreads();
      expect(await screen.findByText('Sushi ideas')).not.toBeNull();
      expect(screen.queryByTestId('agent-route-sidebar-skeleton')).toBeNull();
    });
  });

  it('highlights the Chat tab in the agent tab bar', async () => {
    installHandlers();
    renderAt(`/agents/${AGENT_ID}/threads/${THREAD_ID}`);

    await screen.findByText('Tonight we cook carbonara.');
    expect(screen.getByRole('tab', { name: 'Chat' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.queryByRole('tab', { name: 'Overview' })).toBeNull();
  });

  it('highlights the Chat tab on /threads/new', async () => {
    installHandlers();
    renderAt(`/agents/${AGENT_ID}/threads/new`);

    await screen.findByText('Sushi ideas');
    expect(screen.getByRole('tab', { name: 'Chat' }).getAttribute('aria-selected')).toBe('true');
  });

  it('navigates to another thread when clicked in the list', async () => {
    installHandlers();
    renderAt(`/agents/${AGENT_ID}/threads/${THREAD_ID}`);

    const otherThread = await screen.findByText('Sushi ideas');
    fireEvent.click(otherThread);

    await waitFor(() =>
      expect(screen.getByTestId('location-probe').textContent).toBe(`/agents/${AGENT_ID}/threads/thread-2`),
    );
  });

  it('redirects /agents/:agentId/threads to /threads/new', async () => {
    installHandlers();
    renderAt(`/agents/${AGENT_ID}/threads`);

    await waitFor(() =>
      expect(screen.getByTestId('location-probe').textContent).toBe(`/agents/${AGENT_ID}/threads/new`),
    );
  });

  it('redirects bare /agents/:agentId to the new-thread chat', async () => {
    installHandlers();
    renderAt(`/agents/${AGENT_ID}`);

    await waitFor(() =>
      expect(screen.getByTestId('location-probe').textContent).toBe(`/agents/${AGENT_ID}/threads/new`),
    );
  });

  it('redirects the legacy chat URL to /threads/:threadId preserving ?messageId=', async () => {
    installHandlers();
    renderAt(`/agents/${AGENT_ID}/chat/${THREAD_ID}?messageId=msg-1`);

    await waitFor(() =>
      expect(screen.getByTestId('location-probe').textContent).toBe(
        `/agents/${AGENT_ID}/threads/${THREAD_ID}?messageId=msg-1`,
      ),
    );
  });

  it('redirects the legacy /chat URL to /threads/new', async () => {
    installHandlers();
    renderAt(`/agents/${AGENT_ID}/chat`);

    await waitFor(() =>
      expect(screen.getByTestId('location-probe').textContent).toBe(`/agents/${AGENT_ID}/threads/new`),
    );
  });

  it('does not fetch traces nor render a traces aside in the chat view', async () => {
    installHandlers();
    renderAt(`/agents/${AGENT_ID}/threads/${THREAD_ID}`);

    await screen.findByText('Tonight we cook carbonara.');
    expect(screen.queryByRole('button', { name: /traces/i })).toBeNull();
    expect(screen.queryByRole('complementary')).toBeNull();
    expect(onTracesRequest).not.toHaveBeenCalled();
  });

  it('does not fetch traces on /new', async () => {
    installHandlers();
    renderAt(`/agents/${AGENT_ID}/threads/new`);

    await screen.findByText('Sushi ideas');
    expect(screen.queryByRole('button', { name: /traces/i })).toBeNull();
    expect(onTracesRequest).not.toHaveBeenCalled();
  });

  it('shows the session expired screen on a 401', async () => {
    installHandlers();
    server.use(
      http.get(`${BASE_URL}/api/agents/${AGENT_ID}`, () =>
        HttpResponse.json({ error: 'unauthorized' }, { status: 401 }),
      ),
    );
    renderAt(`/agents/${AGENT_ID}/threads/${THREAD_ID}`);

    expect((await screen.findAllByText(/session.*expired/i)).length).toBeGreaterThan(0);
  });

  it('shows the permission denied screen on a 403', async () => {
    installHandlers();
    server.use(
      http.get(`${BASE_URL}/api/agents/${AGENT_ID}`, () => HttpResponse.json({ error: 'forbidden' }, { status: 403 })),
    );
    renderAt(`/agents/${AGENT_ID}/threads/${THREAD_ID}`);

    expect(await screen.findByText('Permission Denied')).not.toBeNull();
  });

  describe('thread deletion', () => {
    // Regression for #22763: the standalone sidebar shipped without any delete
    // affordance on thread rows, so persisted threads could not be removed.
    it('deletes a thread from the sidebar after confirmation and refreshes the list', async () => {
      installHandlers();
      const onDelete = vi.fn<() => void>();
      let deleted = false;
      server.use(
        http.get(`${BASE_URL}/api/memory/threads`, () =>
          HttpResponse.json(
            deleted ? { threads: threadsResponse.threads.filter(t => t.id !== 'thread-2') } : threadsResponse,
          ),
        ),
        http.delete(`${BASE_URL}/api/memory/threads/thread-2`, ({ request }) => {
          onDelete();
          expect(new URL(request.url).searchParams.get('agentId')).toBe(AGENT_ID);
          deleted = true;
          return HttpResponse.json({ result: 'deleted' });
        }),
      );

      renderAt(`/agents/${AGENT_ID}/threads/${THREAD_ID}`);
      await screen.findByText('Sushi ideas');

      const deleteButtons = screen.getAllByRole('button', { name: /delete thread/i });
      expect(deleteButtons).toHaveLength(2);
      fireEvent.click(deleteButtons[1]);

      // Confirmation dialog gates the deletion.
      expect(await screen.findByText('Are you absolutely sure?')).not.toBeNull();
      expect(onDelete).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

      await waitFor(() => expect(onDelete).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(screen.queryByText('Sushi ideas')).toBeNull());
      // The non-active thread was deleted: no redirect away from the current thread.
      expect(screen.getByTestId('location-probe').textContent).toBe(`/agents/${AGENT_ID}/threads/${THREAD_ID}`);
    });

    it('redirects to /threads/new when the active thread is deleted', async () => {
      installHandlers();
      server.use(
        http.delete(`${BASE_URL}/api/memory/threads/${THREAD_ID}`, () => HttpResponse.json({ result: 'deleted' })),
      );

      renderAt(`/agents/${AGENT_ID}/threads/${THREAD_ID}`);
      await screen.findByText('Pasta night');

      fireEvent.click(screen.getAllByRole('button', { name: /delete thread/i })[0]);
      fireEvent.click(await screen.findByRole('button', { name: 'Continue' }));

      await waitFor(() =>
        expect(screen.getByTestId('location-probe').textContent).toBe(`/agents/${AGENT_ID}/threads/new`),
      );
    });

    it('hides the delete control when the user lacks the memory:delete permission', async () => {
      installHandlers();
      server.use(
        http.get(`${BASE_URL}/api/auth/capabilities`, () =>
          HttpResponse.json({
            enabled: true,
            login: { type: 'credentials' },
            user: { id: 'user-1', email: 'user@example.com' },
            capabilities: { user: true, session: true, sso: false, rbac: true, acl: false },
            access: { roles: ['member'], permissions: ['agents:read', 'memory:read'] },
          }),
        ),
      );

      renderAt(`/agents/${AGENT_ID}/threads/${THREAD_ID}`);
      await screen.findByText('Sushi ideas');

      expect(screen.queryByRole('button', { name: /delete thread/i })).toBeNull();
    });
  });

  describe('when a thread has saved model preferences', () => {
    it('retains real composer edits through the first send, navigation, and reload', async () => {
      installHandlers();
      const sent = vi.fn();
      server.use(
        http.get(`${BASE_URL}/api/agents/providers`, () => HttpResponse.json(preferenceModelProviders)),
        http.get(`${BASE_URL}/api/memory/config`, () => HttpResponse.json(memoryConfig)),
        http.get(`${BASE_URL}/api/memory/threads/:threadId/working-memory`, () => HttpResponse.json(workingMemory)),
        http.get(`${BASE_URL}/api/memory/threads/:threadId`, ({ params }) =>
          HttpResponse.json({ ...preferenceThread, id: params.threadId }),
        ),
        http.get(`${BASE_URL}/api/agents/${AGENT_ID}/voice/speakers`, () => HttpResponse.json(voiceSpeakers)),
        http.get(`${BASE_URL}/api/mcp/v0/servers`, () => HttpResponse.json(mcpServers)),
        http.post(
          `${BASE_URL}/api/agents/${AGENT_ID}/threads/subscribe`,
          () => new HttpResponse('', { headers: { 'content-type': 'text/event-stream' } }),
        ),
      );
      server.use(
        http.post(`${BASE_URL}/api/agents/${AGENT_ID}/stream`, async ({ request }) => {
          sent(await request.json());
          return new HttpResponse('data: {"type":"finish","payload":{}}\n\n', {
            headers: { 'content-type': 'text/event-stream' },
          });
        }),
      );
      const router = renderAt(`/agents/${AGENT_ID}/threads/new`);
      fireEvent.click(await screen.findByText('gpt-5-mini'));
      fireEvent.click(await screen.findByRole('option', { name: /gpt-4o-mini/ }));
      fireEvent.click(screen.getByTestId('composer-model-settings-trigger'));
      fireEvent.click(await screen.findByRole('radio', { name: 'Stream' }));
      // Base UI hides slider thumbs until layout measurement, which jsdom cannot provide.
      const temperature = screen.getAllByRole('slider', { hidden: true })[0];
      fireEvent.change(temperature, { target: { value: '0.2' } });
      fireEvent.click(screen.getByRole('button', { name: 'Advanced Settings' }));
      fireEvent.change(await screen.findByLabelText('Max Steps'), { target: { value: '8' } });
      fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
      fireEvent.keyDown(screen.getByTestId('composer-model-settings-trigger'), { key: 'Escape' });
      const firstInput = await screen.findByRole('textbox');
      fireEvent.change(firstInput, { target: { value: 'Save my preferences' } });
      fireEvent.keyDown(firstInput, { key: 'Enter', code: 'Enter' });
      await waitFor(() => expect(sent).toHaveBeenCalledOnce());
      await waitFor(() => expect(router.state.location.pathname).not.toBe(`/agents/${AGENT_ID}/threads/new`));
      const savedPath = router.state.location.pathname;
      expect(sent).toHaveBeenLastCalledWith(
        expect.objectContaining({
          model: 'openai/gpt-4o-mini',
          maxSteps: 8,
          modelSettings: expect.objectContaining({ temperature: 0.2 }),
        }),
      );
      expect(await screen.findByText('gpt-4o-mini')).toBeTruthy();
      await act(() => router.navigate(`/agents/${AGENT_ID}/threads/thread-2`));
      expect(await screen.findByText('gpt-5-mini')).toBeTruthy();
      await act(() => router.navigate(savedPath));
      expect(await screen.findByText('gpt-4o-mini')).toBeTruthy();
      cleanup();
      renderAt(savedPath);
      expect(await screen.findByText('gpt-4o-mini')).toBeTruthy();
      fireEvent.click(screen.getByTestId('composer-model-settings-trigger'));
      expect((await screen.findByRole('radio', { name: 'Stream' })).getAttribute('aria-checked')).toBe('true');
      fireEvent.keyDown(screen.getByTestId('composer-model-settings-trigger'), { key: 'Escape' });
      const input = await screen.findByRole('textbox');
      fireEvent.change(input, { target: { value: 'Use my saved settings' } });
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
      await waitFor(() => expect(sent).toHaveBeenCalledTimes(2));
      expect(sent).toHaveBeenLastCalledWith(
        expect.objectContaining({
          model: 'openai/gpt-4o-mini',
          maxSteps: 8,
          modelSettings: expect.objectContaining({ temperature: 0.2 }),
        }),
      );
    });
  });

  describe('when the agent has a persisted per-entity request context', () => {
    it('sends it in the message request body', async () => {
      installHandlers();
      window.localStorage.setItem(`mastra:request-context:agent:${AGENT_ID}`, JSON.stringify({ userId: 'u-1' }));
      const sent = vi.fn();
      const subscribed = vi.fn();
      server.use(
        http.get(`${BASE_URL}/api/agents/${AGENT_ID}/voice/speakers`, () => HttpResponse.json([])),
        http.get(`${BASE_URL}/api/memory/config`, () => HttpResponse.json({ config: {} })),
        http.get(`${BASE_URL}/api/memory/threads/:threadId/working-memory`, () =>
          HttpResponse.json({ workingMemory: null }),
        ),
        http.get(`${BASE_URL}/api/memory/threads/:threadId`, () => HttpResponse.json(threadsResponse.threads[0])),
        http.get(`${BASE_URL}/api/mcp/v0/servers`, () => HttpResponse.json({ servers: [] })),
        http.post(`${BASE_URL}/api/agents/${AGENT_ID}/threads/subscribe`, () => {
          subscribed();
          return new HttpResponse(new ReadableStream<Uint8Array>(), {
            headers: { 'Content-Type': 'text/event-stream' },
          });
        }),
        http.post(`${BASE_URL}/api/agents/${AGENT_ID}/send-message`, async ({ request }) => {
          sent(await request.json());
          return HttpResponse.json({ accepted: true, runId: 'run-1' });
        }),
      );
      renderAt(`/agents/${AGENT_ID}/threads/new`);
      await waitFor(() => expect(subscribed).toHaveBeenCalled());
      const input = await screen.findByRole('textbox');
      fireEvent.change(input, { target: { value: 'Who am I?' } });
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

      await waitFor(() => expect(sent).toHaveBeenCalledOnce());
      expect(sent).toHaveBeenLastCalledWith(
        expect.objectContaining({
          ifIdle: expect.objectContaining({
            streamOptions: expect.objectContaining({ requestContext: { userId: 'u-1' } }),
          }),
        }),
      );
    });
  });

  describe('when the user opens run options from the composer', () => {
    it('shows the per-agent request context editor', async () => {
      installHandlers();
      server.use(
        http.get(`${BASE_URL}/api/agents/${AGENT_ID}/voice/speakers`, () => HttpResponse.json([])),
        http.get(`${BASE_URL}/api/memory/config`, () => HttpResponse.json({ config: {} })),
        http.get(`${BASE_URL}/api/memory/threads/:threadId/working-memory`, () =>
          HttpResponse.json({ workingMemory: null }),
        ),
        http.get(`${BASE_URL}/api/memory/threads/:threadId`, () => HttpResponse.json(threadsResponse.threads[0])),
        http.get(`${BASE_URL}/api/mcp/v0/servers`, () => HttpResponse.json({ servers: [] })),
        http.post(
          `${BASE_URL}/api/agents/${AGENT_ID}/threads/subscribe`,
          () =>
            new HttpResponse(new ReadableStream<Uint8Array>(), {
              headers: { 'Content-Type': 'text/event-stream' },
            }),
        ),
      );
      renderAt(`/agents/${AGENT_ID}/threads/new`);

      fireEvent.click(await screen.findByTestId('composer-run-options-trigger'));

      expect(await screen.findByText('Request Context (JSON)')).not.toBeNull();
      expect(await screen.findByText('Tracing Options (JSON)')).not.toBeNull();
    });

    it('keeps the popover open after saving request context while the agent refetches', async () => {
      (window as typeof window & { MASTRA_REQUEST_CONTEXT_PRESETS?: string }).MASTRA_REQUEST_CONTEXT_PRESETS =
        JSON.stringify({ French: { locale: 'fr' } });
      installHandlers();
      server.use(
        http.get(`${BASE_URL}/api/agents/${AGENT_ID}/voice/speakers`, () => HttpResponse.json([])),
        http.get(`${BASE_URL}/api/memory/config`, () => HttpResponse.json({ config: {} })),
        http.get(`${BASE_URL}/api/memory/threads/:threadId/working-memory`, () =>
          HttpResponse.json({ workingMemory: null }),
        ),
        http.get(`${BASE_URL}/api/memory/threads/:threadId`, () => HttpResponse.json(threadsResponse.threads[0])),
        http.get(`${BASE_URL}/api/mcp/v0/servers`, () => HttpResponse.json({ servers: [] })),
        http.post(
          `${BASE_URL}/api/agents/${AGENT_ID}/threads/subscribe`,
          () =>
            new HttpResponse(new ReadableStream<Uint8Array>(), {
              headers: { 'Content-Type': 'text/event-stream' },
            }),
        ),
      );
      renderAt(`/agents/${AGENT_ID}/threads/new`);

      fireEvent.click(await screen.findByTestId('composer-run-options-trigger'));
      const popover = (await screen.findByText('Run options')).closest('[role="dialog"]') as HTMLElement;

      fireEvent.click(within(popover).getByRole('combobox'));
      const presetOption = await screen.findByRole('option', { name: 'French' });
      fireEvent.pointerDown(presetOption, { pointerType: 'mouse' });
      fireEvent.click(presetOption, { detail: 1 });
      const saveButton = within(popover).getByRole('button', { name: 'Save' }) as HTMLButtonElement;
      await waitFor(() => expect(saveButton.disabled).toBe(false));
      fireEvent.click(saveButton);

      await waitFor(() =>
        expect(window.localStorage.getItem(`mastra:request-context:agent:${AGENT_ID}`)).toBe(
          JSON.stringify({ locale: 'fr' }),
        ),
      );
      // The agent query refetches with the new context; the chat must not drop into
      // its loading skeleton (which would remount the composer and close the popover).
      await waitFor(() => expect(screen.queryByTestId('composer-run-options-trigger')).not.toBeNull());
      expect(screen.queryByText('Request Context (JSON)')).not.toBeNull();
      expect(screen.queryByText('Tracing Options (JSON)')).not.toBeNull();
      delete (window as typeof window & { MASTRA_REQUEST_CONTEXT_PRESETS?: string }).MASTRA_REQUEST_CONTEXT_PRESETS;
    });
  });

  describe('when the current agent no longer exists', () => {
    beforeEach(() => {
      const missingAgent = () => HttpResponse.json({ error: 'Agent not found' }, { status: 404 });
      server.use(
        http.get(`${BASE_URL}/api/agents/${AGENT_ID}/voice/speakers`, missingAgent),
        http.get(`${BASE_URL}/api/memory/config`, missingAgent),
        http.get(`${BASE_URL}/api/memory/threads/:threadId/working-memory`, missingAgent),
        http.get(`${BASE_URL}/api/memory/threads/:threadId`, missingAgent),
        http.post(`${BASE_URL}/api/agents/${AGENT_ID}/threads/subscribe`, missingAgent),
      );
    });

    it.each(['threads', 'session'])('replaces cached %s chat data with actionable recovery', async route => {
      installHandlers();
      server.use(
        http.get(`${BASE_URL}/api/agents/${AGENT_ID}`, () =>
          HttpResponse.json({ error: 'Agent not found' }, { status: 404 }),
        ),
      );
      const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      queryClient.setQueryData(['agent', AGENT_ID, {}], agentResponse);
      renderAt(`/agents/${AGENT_ID}/${route}/${THREAD_ID}`, queryClient);

      expect(await screen.findByText('Agent not found')).not.toBeNull();
      expect(screen.getByText(/may have been renamed or removed/)).not.toBeNull();
      expect(screen.getByRole('button', { name: 'Reload' })).not.toBeNull();
      expect(screen.getByRole('link', { name: 'Choose agent' })).not.toBeNull();
      expect(screen.queryByPlaceholderText('Enter your message...')).toBeNull();
    });

    it('lets the user leave the dead chat and choose an agent', async () => {
      installHandlers();
      server.use(
        http.get(`${BASE_URL}/api/agents/${AGENT_ID}`, () =>
          HttpResponse.json({ error: 'Agent not found' }, { status: 404 }),
        ),
      );
      renderAt(`/agents/${AGENT_ID}/threads/${THREAD_ID}`);
      fireEvent.click(await screen.findByRole('link', { name: 'Choose agent' }));
      await waitFor(() => expect(screen.getByTestId('location-probe').textContent).toBe('/agents'));
    });
  });

  it('shows "Agent not found" for an unknown agent', async () => {
    installHandlers();
    server.use(http.get(`${BASE_URL}/api/agents/${AGENT_ID}`, () => HttpResponse.json(null)));
    renderAt(`/agents/${AGENT_ID}/threads/${THREAD_ID}`);

    expect(await screen.findByText('Agent not found')).not.toBeNull();
  });
});

describe('thread link builders', () => {
  it('point to the standalone thread routes', () => {
    expect(paths.agentLink(AGENT_ID)).toBe(`/agents/${AGENT_ID}/threads/new`);
    expect(paths.agentNewThreadLink(AGENT_ID)).toBe(`/agents/${AGENT_ID}/threads/new`);
    expect(paths.agentThreadLink(AGENT_ID, THREAD_ID)).toBe(`/agents/${AGENT_ID}/threads/${THREAD_ID}`);
    expect(paths.agentThreadLink(AGENT_ID, THREAD_ID, 'msg-1')).toBe(
      `/agents/${AGENT_ID}/threads/${THREAD_ID}?messageId=msg-1`,
    );
  });
});
