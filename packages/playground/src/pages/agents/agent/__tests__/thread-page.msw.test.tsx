// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createContext, useContext, useEffect, useImperativeHandle, useState } from 'react';
import type { ReactNode, Ref } from 'react';
import { createMemoryRouter, Outlet, RouterProvider, useLocation } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import AgentThread from '../thread';
import { AgentLayout } from '@/domains/agents/agent-layout';
import {
  emptyThreadTracesList,
  threadTracesList,
  traceASpans,
  traceBSpans,
} from '@/domains/traces/components/__tests__/fixtures/thread-traces';
import { agentIndexLoader, agentThreadsIndexLoader, legacyAgentChatLoader, paths } from '@/lib/app-routing';
import { LinkComponentProvider } from '@/lib/framework';
import { Link } from '@/lib/link';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
const AGENT_ID = 'chef-agent';
const THREAD_ID = 'thread-1';

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
          { path: 'overview', element: <div data-testid="overview-page" /> },
        ],
      },
    ],
    { initialEntries: [initialEntry] },
  );

const renderAt = (initialEntry: string) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
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
    expect(screen.getByRole('tab', { name: 'Overview' }).getAttribute('aria-selected')).toBe('false');
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

  it('redirects bare /agents/:agentId to the overview page', async () => {
    installHandlers();
    renderAt(`/agents/${AGENT_ID}`);

    await waitFor(() => expect(screen.getByTestId('location-probe').textContent).toBe(`/agents/${AGENT_ID}/overview`));
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

  it('does not render the "Show thread traces" switch nor fetch traces on /new', async () => {
    installHandlers();
    renderAt(`/agents/${AGENT_ID}/threads/new`);

    await screen.findByText('Sushi ideas');
    expect(screen.queryByRole('switch', { name: 'Show thread traces' })).toBeNull();
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

  describe('with ?variant=advanced', () => {
    const installTraceHandlers = () => {
      server.use(
        http.get(`${BASE_URL}/api/observability/traces/light`, () => HttpResponse.json(threadTracesList)),
        http.get(`${BASE_URL}/api/observability/traces`, () => HttpResponse.json(threadTracesList)),
        http.get(`${BASE_URL}/api/observability/traces/:traceId`, ({ params }) =>
          HttpResponse.json(params.traceId === 'trace-b' ? traceBSpans : traceASpans),
        ),
      );
    };

    it('renders the thread as its traces instead of the chat', async () => {
      installHandlers();
      installTraceHandlers();
      renderAt(`/agents/${AGENT_ID}/threads/${THREAD_ID}?variant=advanced`);

      expect(await screen.findByTestId('thread-view-by-trace')).not.toBeNull();
      expect(await screen.findByText('Chef agent run')).not.toBeNull();
      expect(screen.queryByText('Tonight we cook carbonara.')).toBeNull();
      expect(screen.queryByRole('button', { name: 'Traces' })).toBeNull();
    });

    it('still renders the chat for a new thread', async () => {
      installHandlers();
      installTraceHandlers();
      renderAt(`/agents/${AGENT_ID}/threads/new?variant=advanced`);

      expect(await screen.findByText('Sushi ideas')).not.toBeNull();
      expect(screen.queryByTestId('thread-view-by-trace')).toBeNull();
      expect(screen.queryByRole('switch', { name: 'Show thread traces' })).toBeNull();
    });

    it('is toggled from the "Show thread traces" switch in the tab bar', async () => {
      installHandlers();
      installTraceHandlers();
      renderAt(`/agents/${AGENT_ID}/threads/${THREAD_ID}`);

      const toggle = await screen.findByRole('switch', { name: 'Show thread traces' });
      expect(toggle.getAttribute('aria-checked')).toBe('false');

      fireEvent.click(toggle);
      await waitFor(() =>
        expect(screen.getByTestId('location-probe').textContent).toBe(
          `/agents/${AGENT_ID}/threads/${THREAD_ID}?variant=advanced`,
        ),
      );
      expect(await screen.findByTestId('thread-view-by-trace')).not.toBeNull();

      fireEvent.click(screen.getByRole('switch', { name: 'Show thread traces' }));
      await waitFor(() =>
        expect(screen.getByTestId('location-probe').textContent).toBe(`/agents/${AGENT_ID}/threads/${THREAD_ID}`),
      );
      expect(screen.queryByTestId('thread-view-by-trace')).toBeNull();
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
    expect(paths.agentLink(AGENT_ID)).toBe(`/agents/${AGENT_ID}/overview`);
    expect(paths.agentNewThreadLink(AGENT_ID)).toBe(`/agents/${AGENT_ID}/threads/new`);
    expect(paths.agentThreadLink(AGENT_ID, THREAD_ID)).toBe(`/agents/${AGENT_ID}/threads/${THREAD_ID}`);
    expect(paths.agentThreadLink(AGENT_ID, THREAD_ID, 'msg-1')).toBe(
      `/agents/${AGENT_ID}/threads/${THREAD_ID}?messageId=msg-1`,
    );
  });
});
