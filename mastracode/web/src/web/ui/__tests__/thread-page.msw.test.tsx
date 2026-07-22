/**
 * BDD coverage for URL-driven thread pages (`/threads/:threadId`).
 *
 * The URL is the source of truth for the displayed thread: deep links hydrate
 * persisted messages through TanStack Query (with a skeleton while pending),
 * the sidebar navigates instead of mutating local state, and thread CRUD
 * lands on the right URL. `/new` is the draft page: it never redirects and
 * persists nothing — the first send creates the thread and navigates to its
 * page. Driven through a memory router over the real route table with MSW at
 * the network boundary.
 */
import type { AgentControllerSessionState, AgentControllerThreadInfo } from '@mastra/client-js';
import type { MastraDBMessage } from '@mastra/core/agent-controller';
import { QueryClient } from '@tanstack/react-query';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { server } from '../../../../e2e/web-ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../e2e/web-ui/render';
import type * as AuthService from '../domains/auth/services/auth';
import type { Factory } from '../domains/workspaces';
import { createAppRoutes } from '../router';

// jsdom's `window.location.assign` is unforgeable (cannot be spied on), so the
// service-level navigation helper is stubbed (same setup as routing tests).
vi.mock('../domains/auth/services/auth', async importOriginal => {
  const actual = await importOriginal<typeof AuthService>();
  return { ...actual, redirectToLogin: vi.fn() };
});

const API = `${TEST_BASE_URL}/api/agent-controller/code`;
const RESOURCE_ID = 'resource-test';

function thread(id: string, title: string, updatedAt: string): AgentControllerThreadInfo {
  return { id, title, resourceId: RESOURCE_ID, createdAt: '2026-06-01T00:00:00.000Z', updatedAt };
}

const threadOne = thread('thread-one', 'First thread', '2026-06-04T00:00:00.000Z');
const threadTwo = thread('thread-two', 'Second thread', '2026-06-02T00:00:00.000Z');
const newThread = thread('thread-new', 'New thread', '2026-06-05T00:00:00.000Z');

/** Persisted history per thread; unknown threads have no messages. */
const MESSAGES: Record<string, MastraDBMessage[]> = {
  [threadOne.id]: [
    {
      id: 'm-one',
      role: 'assistant',
      createdAt: new Date('2026-06-04T00:00:00.000Z'),
      content: { format: 2, parts: [{ type: 'text', text: 'Reply from thread one' }] },
    },
  ],
  [threadTwo.id]: [
    {
      id: 'm-two',
      role: 'assistant',
      createdAt: new Date('2026-06-02T00:00:00.000Z'),
      content: { format: 2, parts: [{ type: 'text', text: 'Reply from thread two' }] },
    },
  ],
};

afterEach(() => {
  localStorage.clear();
});

/** Factory-scoped URL base for the default seeded factory. */
const BASE = '/factories/project-test';

function seedFactory(projects?: Factory[]) {
  const project: Factory = {
    id: 'project-test',
    name: 'MastraCode Test',
    resourceId: RESOURCE_ID,
    createdAt: 1,
    binding: {
      kind: 'local',
      path: '/tmp/mastracode-test',
    },
  };
  const storedProjects = projects ?? [project];
  localStorage.setItem('mastracode-factories', JSON.stringify(storedProjects));
}

function sessionState(threadId: string): AgentControllerSessionState {
  return {
    controllerId: 'code',
    resourceId: RESOURCE_ID,
    modeId: 'build',
    modelId: 'openai/gpt-4o-mini',
    threadId,
    settings: { yolo: false, thinkingLevel: 'medium', notifications: 'bell', smartEditing: true },
  };
}

function emptySse(): Response {
  return new Response(
    new ReadableStream<Uint8Array>({
      start() {},
      cancel() {},
    }),
    { headers: { 'content-type': 'text/event-stream' } },
  );
}

interface CapturedRequests {
  sessionsCreated: number;
  streamSubscriptions: number;
  switched: string[];
  created: number;
  deleted: string[];
  sent: string[];
}

function useAgentControllerHandlers({
  boundThreadId = threadOne.id,
  messagesDelayMs = 0,
  messagesDelayMsByThread = {},
  stateDelayMs = 0,
  switchDelayMsByThread = {},
  failSwitchFor = [],
}: {
  boundThreadId?: string;
  messagesDelayMs?: number;
  messagesDelayMsByThread?: Partial<Record<string, number>>;
  /** Delays `GET /sessions/:resourceId` (the state fetch) to expose hydration races. */
  stateDelayMs?: number;
  switchDelayMsByThread?: Partial<Record<string, number>>;
  failSwitchFor?: string[];
} = {}): CapturedRequests {
  const captured: CapturedRequests = {
    sessionsCreated: 0,
    streamSubscriptions: 0,
    switched: [],
    created: 0,
    deleted: [],
    sent: [],
  };
  // The bound thread follows successful switches so `GET /sessions/:id` stays authoritative.
  let bound = boundThreadId;
  let stateShouldFail = false;

  server.use(
    http.get(`${TEST_BASE_URL}/auth/me`, () => new Response(null, { status: 404 })),
    http.get(`${TEST_BASE_URL}/web/github/status`, () =>
      HttpResponse.json({ enabled: true, connected: false, installations: [] }),
    ),
    http.post(`${API}/sessions`, () => {
      captured.sessionsCreated += 1;
      return HttpResponse.json({ controllerId: 'code', resourceId: RESOURCE_ID, threadId: bound });
    }),
    http.get(`${API}/modes`, () => HttpResponse.json({ modes: [{ id: 'build', label: 'Build' }] })),
    http.get(`${API}/models`, () => HttpResponse.json({ models: [] })),
    http.get(`${API}/sessions/:resourceId`, async () => {
      if (stateDelayMs > 0) await delay(stateDelayMs);
      if (stateShouldFail) return HttpResponse.error();
      return HttpResponse.json(sessionState(bound));
    }),
    http.put(`${API}/sessions/:resourceId/state`, () => HttpResponse.json(sessionState(bound))),
    http.get(`${API}/sessions/:resourceId/permissions`, () => HttpResponse.json({ categories: {}, tools: {} })),
    http.get(`${API}/sessions/:resourceId/threads`, () =>
      HttpResponse.json({ threads: captured.created > 0 ? [newThread, threadOne, threadTwo] : [threadOne, threadTwo] }),
    ),
    http.get(`${API}/sessions/:resourceId/threads/:threadId/messages`, async ({ params }) => {
      const threadId = String(params.threadId);
      const messagesDelay = messagesDelayMsByThread[threadId] ?? messagesDelayMs;
      if (messagesDelay > 0) await delay(messagesDelay);
      if (threadId === newThread.id && captured.sent.length > 0) {
        const messages: MastraDBMessage[] = captured.sent.map((text, index) => ({
          id: `sent-${index}`,
          role: 'user',
          createdAt: new Date(),
          content: { format: 2, parts: [{ type: 'text', text }] },
        }));
        return HttpResponse.json({ messages });
      }
      return HttpResponse.json({ messages: MESSAGES[threadId] ?? [] });
    }),
    http.get(`${API}/sessions/:resourceId/stream`, () => {
      captured.streamSubscriptions += 1;
      return emptySse();
    }),
    http.post(`${API}/sessions/:resourceId/thread`, async ({ request }) => {
      const { threadId } = (await request.json()) as { threadId: string };
      captured.switched.push(threadId);
      const switchDelayMs = switchDelayMsByThread[threadId] ?? 0;
      if (switchDelayMs > 0) await delay(switchDelayMs);
      if (failSwitchFor.includes(threadId)) {
        stateShouldFail = true;
        return HttpResponse.json({ ok: false });
      }
      bound = threadId;
      return HttpResponse.json({ ok: true });
    }),
    http.post(`${API}/sessions/:resourceId/threads`, () => {
      captured.created += 1;
      bound = newThread.id;
      return HttpResponse.json(newThread);
    }),
    http.delete(`${API}/sessions/:resourceId/threads/:threadId`, ({ params }) => {
      captured.deleted.push(String(params.threadId));
      return HttpResponse.json({ ok: true });
    }),
    http.get(`${TEST_BASE_URL}/web/workspace/rendered/list`, () =>
      HttpResponse.json({ rootPath: '/tmp/mastracode-test', renderedPath: '.artifacts', entries: [] }),
    ),
    http.post(`${API}/sessions/:resourceId/messages`, async ({ request }) => {
      const { message } = (await request.json()) as { message: string };
      captured.sent.push(message);
      return HttpResponse.json({ ok: true });
    }),
  );

  return captured;
}

/**
 * Mounts the app route table. `initialEntry` is factory-relative (e.g.
 * `/threads/x`, `/new`) and gets prefixed with `/factories/:factoryId` for the
 * active factory (default seeded factory unless `activeFactoryId` is given).
 */
function renderRoutes(initialEntry: string, projects?: Factory[], activeFactoryId?: string) {
  seedFactory(projects);
  const factoryId = activeFactoryId ?? projects?.[0]?.id ?? 'project-test';

  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const router = createMemoryRouter(createAppRoutes(), { initialEntries: [`/factories/${factoryId}${initialEntry}`] });
  renderWithProviders(<RouterProvider router={router} />, client);
  return { router, client };
}

async function expectPathname(router: ReturnType<typeof createMemoryRouter>, pathname: string) {
  await waitFor(() => expect(router.state.location.pathname).toBe(pathname));
}

describe('MastraCode thread pages', () => {
  it('hides user-session workspace files when the thread belongs to another project', async () => {
    const activeFactory: Factory = {
      id: 'project-active',
      name: 'Active factory',
      resourceId: RESOURCE_ID,
      createdAt: 1,
      binding: {
        kind: 'local',
        path: '/tmp/active-project',
      },
    };
    const threadProject: Factory = {
      id: 'project-thread',
      name: 'Thread project',
      resourceId: RESOURCE_ID,
      createdAt: 2,
      binding: {
        kind: 'factory',
        factoryProjectId: 'fp-github-thread',
        repositories: [
          {
            projectRepositoryId: 'pr-github-thread',
            slug: 'mastra-ai/thread-project',
            worktrees: [
              {
                branch: 'user/thread-session',
                worktreePath: '/tmp/thread-project-session',
                baseBranch: 'main',
                threadId: threadOne.id,
              },
            ],
          },
        ],
      },
    };

    useAgentControllerHandlers();
    renderRoutes(`/user/threads/${threadOne.id}`, [activeFactory, threadProject], activeFactory.id);

    await waitFor(() => expect(screen.getByText('Reply from thread one')).toBeInTheDocument());
    expect(screen.queryByTestId('workspace-viewer-panel')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open workspace files' })).not.toBeInTheDocument();
  });

  it('given persisted messages load slowly, when deep-linking to /threads/:threadId, then a skeleton renders before the thread history', async () => {
    useAgentControllerHandlers({ messagesDelayMs: 150 });
    renderRoutes(`/threads/${threadOne.id}`);

    expect(await screen.findByRole('status', { name: 'Loading messages' })).toBeInTheDocument();

    await waitFor(() => expect(screen.getByText('Reply from thread one')).toBeInTheDocument());
    const threadComposer = screen.getByRole('region', { name: 'Thread composer' });
    expect(within(threadComposer).getByRole('textbox', { name: 'Message' })).toBeVisible();
    expect(within(threadComposer).getByRole('button', { name: 'Attach image' })).toBeVisible();
    expect(within(threadComposer).getByRole('button', { name: 'Send message' })).toBeVisible();
    expect(screen.queryByRole('status', { name: 'Loading messages' })).not.toBeInTheDocument();
  });

  it('given destination history loads slowly, when selecting another thread, then loading feedback renders before the destination history', async () => {
    useAgentControllerHandlers({ messagesDelayMsByThread: { [threadTwo.id]: 150 } });
    const { router } = renderRoutes(`/threads/${threadOne.id}`);

    await waitFor(() => expect(screen.getByText('Reply from thread one')).toBeInTheDocument());

    await userEvent.click(await screen.findByText('Second thread'));

    await expectPathname(router, `${BASE}/threads/${threadTwo.id}`);
    expect(await screen.findByRole('status', { name: 'Loading messages' })).toBeInTheDocument();

    await waitFor(() => expect(screen.getByText('Reply from thread two')).toBeInTheDocument());
    expect(screen.getByRole('region', { name: 'Thread composer' })).toBeInTheDocument();
  });

  it('given two threads in the sidebar, when clicking another thread, then the URL and session switch to it without recreating the session', async () => {
    const captured = useAgentControllerHandlers();
    const { router } = renderRoutes(`/threads/${threadOne.id}`);

    await waitFor(() => expect(screen.getByText('Reply from thread one')).toBeInTheDocument());

    await userEvent.click(await screen.findByText('Second thread'));

    await expectPathname(router, `${BASE}/threads/${threadTwo.id}`);
    await waitFor(() => expect(captured.switched).toContain(threadTwo.id));
    await waitFor(() => expect(screen.getByText('Reply from thread two')).toBeInTheDocument());
    expect(captured.sessionsCreated).toBe(1);
  });

  it('given the session resumes a bound thread, when visiting /new, then it stays on /new and shows a centered draft composer instead of the old thread', async () => {
    const captured = useAgentControllerHandlers({ boundThreadId: threadOne.id });
    const { router } = renderRoutes('/new');

    expect(await screen.findByRole('heading', { name: 'What do you want to work on?' })).toBeInTheDocument();
    expect(screen.getAllByPlaceholderText(/Ask Mastra Code/)).toHaveLength(1);
    const draftRegion = screen.getByRole('region', { name: 'What do you want to work on?' });
    expect(within(draftRegion).getByRole('textbox', { name: 'Message' })).toBeVisible();
    expect(within(draftRegion).getByRole('button', { name: 'Attach image' })).toBeVisible();
    expect(within(draftRegion).getByRole('button', { name: 'Send message' })).toBeVisible();
    expect(within(draftRegion).getByText('MastraCode Test')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(`${BASE}/new`);
    expect(screen.queryByText('Reply from thread one')).not.toBeInTheDocument();
    expect(captured.created).toBe(0);
  });

  it('given the /new draft page, when sending the first message, then a thread is created and the URL becomes its thread page', async () => {
    const captured = useAgentControllerHandlers();
    const { router } = renderRoutes('/new');

    expect(await screen.findByRole('heading', { name: 'What do you want to work on?' })).toBeInTheDocument();

    const composer = await screen.findByPlaceholderText(/Ask Mastra Code/);
    await waitFor(() => expect(composer).not.toBeDisabled());
    await userEvent.type(composer, 'Hello draft{Enter}');

    await waitFor(() => expect(captured.created).toBe(1));
    await expectPathname(router, `${BASE}/threads/${newThread.id}`);
    await waitFor(() => expect(captured.sent).toEqual(['Hello draft']));
    await waitFor(() => expect(document.body).toHaveTextContent('Hello draft'));
  });

  it('when clicking the new-thread button in the sidebar, then it navigates to the /new draft page without persisting a thread', async () => {
    const captured = useAgentControllerHandlers();
    const { router } = renderRoutes(`/threads/${threadOne.id}`);

    await waitFor(() => expect(screen.getByText('Reply from thread one')).toBeInTheDocument());

    await userEvent.click(await screen.findByRole('button', { name: 'New thread' }));

    await expectPathname(router, `${BASE}/new`);
    expect(await screen.findByRole('heading', { name: 'What do you want to work on?' })).toBeInTheDocument();
    const composer = screen.getByPlaceholderText(/Ask Mastra Code/);
    await waitFor(() => expect(composer).not.toBeDisabled());
    expect(captured.streamSubscriptions).toBe(1);
    expect(captured.created).toBe(0);
  });

  it('given the session state resolves slowly, when switching threads from the sidebar, then the thread history still renders', async () => {
    const captured = useAgentControllerHandlers({ stateDelayMs: 150 });
    const { router } = renderRoutes(`/threads/${threadOne.id}`);

    await waitFor(() => expect(screen.getByText('Reply from thread one')).toBeInTheDocument());

    await userEvent.click(await screen.findByText('Second thread'));

    await expectPathname(router, `${BASE}/threads/${threadTwo.id}`);
    await waitFor(() => expect(captured.switched).toContain(threadTwo.id));
    // The slow state re-sync must not wipe the already-hydrated history.
    await waitFor(() => expect(screen.getByText('Reply from thread two')).toBeInTheDocument());
    await act(() => delay(200));
    expect(screen.getByText('Reply from thread two')).toBeInTheDocument();
  });

  it('given a slow route switch response, when the route changes again, then the stale response does not replace the latest routed thread', async () => {
    const captured = useAgentControllerHandlers({ switchDelayMsByThread: { [threadTwo.id]: 150 } });
    const { router } = renderRoutes(`/threads/${threadOne.id}`);

    await waitFor(() => expect(screen.getByText('Reply from thread one')).toBeInTheDocument());

    await act(() => router.navigate(`${BASE}/threads/${threadTwo.id}`));
    await expectPathname(router, `${BASE}/threads/${threadTwo.id}`);
    await waitFor(() => expect(captured.switched).toContain(threadTwo.id));

    await act(() => router.navigate(`${BASE}/threads/${threadOne.id}`));
    await expectPathname(router, `${BASE}/threads/${threadOne.id}`);
    await waitFor(() => expect(screen.getByText('Reply from thread one')).toBeInTheDocument());

    await act(() => delay(200));
    expect(router.state.location.pathname).toBe(`${BASE}/threads/${threadOne.id}`);
    expect(screen.getByText('Reply from thread one')).toBeInTheDocument();
    expect(screen.queryByText('Reply from thread two')).not.toBeInTheDocument();
  });

  it('when deleting the thread of the current page, then the URL returns to /new', async () => {
    const captured = useAgentControllerHandlers();
    const { router } = renderRoutes(`/threads/${threadOne.id}`);

    await waitFor(() => expect(screen.getByText('Reply from thread one')).toBeInTheDocument());
    // The thread page must survive bootstrap — no wildcard redirect to /new.
    expect(router.state.location.pathname).toBe(`${BASE}/threads/${threadOne.id}`);

    const row = (await screen.findByText('First thread')).closest('[role="listitem"]') as HTMLElement;
    await userEvent.click(within(row).getByRole('button', { name: 'Thread actions' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Delete' }));

    await waitFor(() => expect(captured.deleted).toContain(threadOne.id));
    await expectPathname(router, `${BASE}/new`);
  });

  it('given an invalid thread deep link in the current scope, then it reports the failure and returns to /new', async () => {
    const captured = useAgentControllerHandlers({ failSwitchFor: ['nope'] });
    const { router } = renderRoutes('/threads/nope');

    await expectPathname(router, `${BASE}/new`);
    expect(await screen.findByRole('heading', { name: 'What do you want to work on?' })).toBeInTheDocument();
    expect(screen.getByText('Failed to switch thread: thread nope was not found')).toBeInTheDocument();
    expect(captured.switched).not.toContain('nope');
  });
});
