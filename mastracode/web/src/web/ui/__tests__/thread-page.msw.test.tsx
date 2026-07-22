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
import type { FactoryThreadTaskContext } from '../../../shared/api/types';
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
const FACTORY_PROJECT_ID = 'factory-project-context';
const FACTORY_CONTEXT_URL = `${TEST_BASE_URL}/web/factory/projects/:projectId/threads/:threadId/context`;

class TestMediaQueryList extends EventTarget implements MediaQueryList {
  readonly media: string;
  onchange: MediaQueryList['onchange'] = null;
  private currentMatches: boolean;
  private readonly changeListeners = new Set<EventListenerOrEventListenerObject>();

  constructor(media: string, matches: boolean) {
    super();
    this.media = media;
    this.currentMatches = matches;
  }

  get matches() {
    return this.currentMatches;
  }

  get changeListenerCount() {
    return this.changeListeners.size;
  }

  addListener: MediaQueryList['addListener'] = () => {};
  removeListener: MediaQueryList['removeListener'] = () => {};

  override addEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject | null,
    options?: AddEventListenerOptions | boolean,
  ) {
    if (type === 'change' && callback) this.changeListeners.add(callback);
    super.addEventListener(type, callback, options);
  }

  override removeEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject | null,
    options?: EventListenerOptions | boolean,
  ) {
    if (type === 'change' && callback) this.changeListeners.delete(callback);
    super.removeEventListener(type, callback, options);
  }

  setMatches(matches: boolean) {
    this.currentMatches = matches;
    const event = new Event('change');
    Object.defineProperty(event, 'matches', { value: matches });
    Object.defineProperty(event, 'media', { value: this.media });
    this.dispatchEvent(event);
  }
}

function installDesktopMedia(matches: boolean) {
  const media = new TestMediaQueryList('(min-width: 64rem)', matches);
  const fallbackMatchMedia = window.matchMedia;
  vi.spyOn(window, 'matchMedia').mockImplementation(query =>
    query === '(min-width: 64rem)' ? media : fallbackMatchMedia(query),
  );
  return media;
}

function githubFactory(): Factory {
  return {
    id: 'factory-github',
    name: 'Mastra GitHub',
    resourceId: RESOURCE_ID,
    binding: {
      kind: 'factory',
      factoryProjectId: FACTORY_PROJECT_ID,
      repositories: [
        {
          projectRepositoryId: 'project-repository-context',
          slug: 'mastra-ai/mastra',
          sandboxId: 'sandbox-context',
          sandboxWorkdir: '/tmp/mastra-repository',
          worktrees: [
            {
              branch: 'feat/factory-context',
              worktreePath: '/tmp/mastra-factory',
              baseBranch: 'main',
            },
            {
              branch: 'user/personal-context',
              worktreePath: '/tmp/mastra-personal',
              baseBranch: 'main',
              threadId: threadTwo.id,
            },
          ],
          selectedWorktreePath: '/tmp/mastra-factory',
        },
      ],
      selectedRepositoryId: 'project-repository-context',
    },
    createdAt: 2,
  };
}

function factoryTaskContext(threadId: string): FactoryThreadTaskContext {
  return {
    task: {
      source: 'github-issue',
      identifier: threadId === threadOne.id ? '42' : '77',
      title: threadId === threadOne.id ? 'Factory task one' : 'Factory task two',
      description: `Context for ${threadId}`,
      state: 'open',
      labels: ['factory'],
      assignees: ['ada'],
      url: `https://github.com/mastra-ai/mastra/issues/${threadId === threadOne.id ? '42' : '77'}`,
    },
    resolution: { mode: 'live' },
  };
}

function installFactoryContextHandler(requests: string[]) {
  server.use(
    http.get(FACTORY_CONTEXT_URL, ({ params }) => {
      const threadId = String(params.threadId);
      requests.push(threadId);
      return HttpResponse.json({ context: factoryTaskContext(threadId) });
    }),
  );
}

function installWorkspaceFiles() {
  server.use(
    http.get(`${TEST_BASE_URL}/web/workspace/rendered/list`, () =>
      HttpResponse.json({
        workspacePath: '/tmp/mastra-factory',
        root: '.artifacts',
        rootPath: '/tmp/mastra-factory/.artifacts',
        entries: [
          {
            name: 'proof',
            path: 'proof',
            type: 'directory',
            size: 0,
            updatedAt: '2026-07-17T00:00:00.000Z',
          },
          {
            name: 'NOTES.md',
            path: 'proof/NOTES.md',
            type: 'file',
            size: 7,
            updatedAt: '2026-07-17T00:00:00.000Z',
          },
        ],
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/workspace/file`, ({ request }) => {
      const path = new URL(request.url).searchParams.get('path');
      return HttpResponse.json({
        workspacePath: '/tmp/mastra-factory',
        path,
        name: 'NOTES.md',
        size: 7,
        updatedAt: '2026-07-17T00:00:00.000Z',
        contentType: 'text',
        content: '# Fixture notes',
      });
    }),
  );
}

function deferred() {
  let resolve: () => void = () => {};
  const promise = new Promise<void>(next => {
    resolve = next;
  });
  return { promise, resolve };
}

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
  vi.restoreAllMocks();
});

function seedFactory(projects?: Factory[], activeFactoryId?: string) {
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
  localStorage.setItem('mastracode-active-factory', activeFactoryId ?? storedProjects[0]?.id ?? project.id);
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
    http.get(`${TEST_BASE_URL}/web/github/subscriptions`, () => HttpResponse.json({ subscriptions: [] })),
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

function renderRoutes(initialEntry: string, projects?: Factory[], activeFactoryId?: string) {
  seedFactory(projects, activeFactoryId);

  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const router = createMemoryRouter(createAppRoutes(), { initialEntries: [initialEntry] });
  const rendered = renderWithProviders(<RouterProvider router={router} />, client);
  return { router, ...rendered };
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

  it('given a desktop Factory thread, when Task and Files are used, then one shared panel fetches only visible Task context', async () => {
    installDesktopMedia(true);
    useAgentControllerHandlers();
    const contextRequests: string[] = [];
    installFactoryContextHandler(contextRequests);
    installWorkspaceFiles();
    const factory = githubFactory();
    const user = userEvent.setup();
    renderRoutes(`/threads/${threadOne.id}`, [factory], factory.id);

    expect(await screen.findByRole('heading', { name: 'Factory task one' })).toBeInTheDocument();
    expect(contextRequests).toEqual([threadOne.id]);
    expect(screen.getByRole('tab', { name: 'Task' })).toHaveAttribute('aria-selected', 'true');

    await user.click(screen.getByRole('tab', { name: 'Files' }));
    await user.click(await screen.findByRole('button', { name: 'Artifacts' }));
    await user.click(await screen.findByRole('button', { name: 'proof' }));
    await user.click(await screen.findByText('NOTES.md'));

    expect(await screen.findByLabelText('Workspace file viewer')).toBeInTheDocument();
    expect(screen.getByLabelText('Session task and workspace context')).toHaveAttribute('data-expanded', 'true');
    expect(contextRequests).toEqual([threadOne.id]);

    await user.click(screen.getByRole('button', { name: 'Close workspace file viewer' }));
    await user.click(screen.getByRole('button', { name: 'Close workspace files' }));
    await user.click(screen.getByRole('button', { name: 'Open task and workspace context' }));

    expect(await screen.findByRole('heading', { name: 'Factory task one' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Task' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByLabelText('Session task and workspace context')).toHaveAttribute('data-expanded', 'false');
    await waitFor(() => expect(contextRequests).toEqual([threadOne.id, threadOne.id]));
  });

  it('given a personal session under a GitHub Factory, when it opens, then it remains Files-only with zero task requests', async () => {
    installDesktopMedia(true);
    useAgentControllerHandlers({ boundThreadId: threadTwo.id });
    const contextRequests: string[] = [];
    installFactoryContextHandler(contextRequests);
    const factory = githubFactory();
    renderRoutes(`/user/threads/${threadTwo.id}`, [factory], factory.id);

    await waitFor(() => expect(screen.getByText('Reply from thread two')).toBeInTheDocument());
    expect(screen.getByTestId('workspace-viewer-panel')).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Task' })).not.toBeInTheDocument();
    expect(contextRequests).toEqual([]);
  });

  it('given a local Factory thread, when it opens, then it remains Files-only with zero task requests', async () => {
    installDesktopMedia(true);
    useAgentControllerHandlers();
    const contextRequests: string[] = [];
    installFactoryContextHandler(contextRequests);
    renderRoutes(`/threads/${threadOne.id}`);

    await waitFor(() => expect(screen.getByText('Reply from thread one')).toBeInTheDocument());
    expect(screen.getByTestId('workspace-viewer-panel')).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Task' })).not.toBeInTheDocument();
    expect(contextRequests).toEqual([]);
  });

  it('given a Factory thread starts on mobile, when desktop availability changes, then requests follow the visible Task lifecycle and listeners clean up', async () => {
    const media = installDesktopMedia(false);
    useAgentControllerHandlers();
    const started = deferred();
    const aborted = deferred();
    let contextRequests = 0;
    server.use(
      http.get(FACTORY_CONTEXT_URL, async ({ request }) => {
        contextRequests += 1;
        if (contextRequests === 1) {
          request.signal.addEventListener('abort', () => aborted.resolve(), { once: true });
          started.resolve();
          await aborted.promise;
        }
        return HttpResponse.json({ context: factoryTaskContext(threadOne.id) });
      }),
    );
    const factory = githubFactory();
    const rendered = renderRoutes(`/threads/${threadOne.id}`, [factory], factory.id);

    await waitFor(() => expect(screen.getByText('Reply from thread one')).toBeInTheDocument());
    expect(contextRequests).toBe(0);
    expect(screen.queryByRole('tab', { name: 'Task' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('workspace-viewer-panel')).not.toBeInTheDocument();

    act(() => media.setMatches(true));
    await started.promise;
    expect(contextRequests).toBe(1);

    act(() => media.setMatches(false));
    await expect(aborted.promise).resolves.toBeUndefined();
    expect(screen.queryByRole('tab', { name: 'Task' })).not.toBeInTheDocument();

    act(() => media.setMatches(true));
    expect(await screen.findByRole('heading', { name: 'Factory task one' })).toBeInTheDocument();
    expect(contextRequests).toBe(2);
    expect(screen.getByLabelText('Session task and workspace context')).toHaveAttribute('data-expanded', 'false');

    rendered.unmount();
    expect(media.changeListenerCount).toBe(0);

    act(() => media.setMatches(false));
    const remounted = renderRoutes(`/threads/${threadOne.id}`, [factory], factory.id);
    await waitFor(() => expect(screen.getByText('Reply from thread one')).toBeInTheDocument());
    expect(contextRequests).toBe(2);
    expect(media.changeListenerCount).toBe(1);

    act(() => media.setMatches(true));
    await waitFor(() => expect(contextRequests).toBe(3));
    remounted.unmount();
    expect(media.changeListenerCount).toBe(0);
  });

  it('given expanded Files on Factory thread A, when navigating A to B to A, then each thread starts on compact Task with its own query key', async () => {
    installDesktopMedia(true);
    useAgentControllerHandlers();
    const contextRequests: string[] = [];
    installFactoryContextHandler(contextRequests);
    installWorkspaceFiles();
    const factory = githubFactory();
    const user = userEvent.setup();
    const { router } = renderRoutes(`/threads/${threadOne.id}`, [factory], factory.id);
    await screen.findByRole('heading', { name: 'Factory task one' });

    await user.click(screen.getByRole('tab', { name: 'Files' }));
    await user.click(await screen.findByRole('button', { name: 'Artifacts' }));
    await user.click(await screen.findByRole('button', { name: 'proof' }));
    await user.click(await screen.findByText('NOTES.md'));
    expect(screen.getByLabelText('Session task and workspace context')).toHaveAttribute('data-expanded', 'true');

    await act(async () => {
      await router.navigate(`/threads/${threadTwo.id}`);
    });
    expect(await screen.findByRole('heading', { name: 'Factory task two' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Task' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByLabelText('Session task and workspace context')).toHaveAttribute('data-expanded', 'false');

    await act(async () => {
      await router.navigate(`/threads/${threadOne.id}`);
    });
    expect(await screen.findByRole('heading', { name: 'Factory task one' })).toBeInTheDocument();
    await waitFor(() => expect(contextRequests).toEqual([threadOne.id, threadTwo.id, threadOne.id]));
  });

  it('given expanded Factory Files, when navigating through a personal session, then personal stays Files-only and Factory returns to compact Task', async () => {
    installDesktopMedia(true);
    useAgentControllerHandlers();
    const contextRequests: string[] = [];
    installFactoryContextHandler(contextRequests);
    installWorkspaceFiles();
    const factory = githubFactory();
    const user = userEvent.setup();
    const { router } = renderRoutes(`/threads/${threadOne.id}`, [factory], factory.id);
    await screen.findByRole('heading', { name: 'Factory task one' });

    await user.click(screen.getByRole('tab', { name: 'Files' }));
    await user.click(await screen.findByRole('button', { name: 'Artifacts' }));
    await user.click(await screen.findByRole('button', { name: 'proof' }));
    await user.click(await screen.findByText('NOTES.md'));

    await act(async () => {
      await router.navigate(`/user/threads/${threadTwo.id}`);
    });
    await waitFor(() => expect(screen.getByText('Reply from thread two')).toBeInTheDocument());
    expect(screen.queryByRole('tab', { name: 'Task' })).not.toBeInTheDocument();
    expect(screen.getByTestId('workspace-viewer-panel')).toBeInTheDocument();
    expect(contextRequests).toEqual([threadOne.id]);

    await act(async () => {
      await router.navigate(`/threads/${threadOne.id}`);
    });
    expect(await screen.findByRole('heading', { name: 'Factory task one' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Task' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByLabelText('Session task and workspace context')).toHaveAttribute('data-expanded', 'false');
    await waitFor(() => expect(contextRequests).toEqual([threadOne.id, threadOne.id]));
  });

  it('given expanded Factory Files, when crossing the desktop breakpoint and returning, then the panel returns to compact Task without stale requests', async () => {
    const media = installDesktopMedia(true);
    useAgentControllerHandlers();
    const contextRequests: string[] = [];
    installFactoryContextHandler(contextRequests);
    installWorkspaceFiles();
    const factory = githubFactory();
    const user = userEvent.setup();
    renderRoutes(`/threads/${threadOne.id}`, [factory], factory.id);
    await screen.findByRole('heading', { name: 'Factory task one' });

    await user.click(screen.getByRole('tab', { name: 'Files' }));
    await user.click(await screen.findByRole('button', { name: 'Artifacts' }));
    await user.click(await screen.findByRole('button', { name: 'proof' }));
    await user.click(await screen.findByText('NOTES.md'));
    expect(screen.getByLabelText('Session task and workspace context')).toHaveAttribute('data-expanded', 'true');

    act(() => media.setMatches(false));
    expect(screen.queryByRole('tab', { name: 'Task' })).not.toBeInTheDocument();
    expect(contextRequests).toEqual([threadOne.id]);

    act(() => media.setMatches(true));
    expect(await screen.findByRole('heading', { name: 'Factory task one' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Task' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByLabelText('Session task and workspace context')).toHaveAttribute('data-expanded', 'false');
    await waitFor(() => expect(contextRequests).toEqual([threadOne.id, threadOne.id]));
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

    await expectPathname(router, `/threads/${threadTwo.id}`);
    expect(await screen.findByRole('status', { name: 'Loading messages' })).toBeInTheDocument();

    await waitFor(() => expect(screen.getByText('Reply from thread two')).toBeInTheDocument());
    expect(screen.getByRole('region', { name: 'Thread composer' })).toBeInTheDocument();
  });

  it('given two threads in the sidebar, when clicking another thread, then the URL and session switch to it without recreating the session', async () => {
    const captured = useAgentControllerHandlers();
    const { router } = renderRoutes(`/threads/${threadOne.id}`);

    await waitFor(() => expect(screen.getByText('Reply from thread one')).toBeInTheDocument());

    await userEvent.click(await screen.findByText('Second thread'));

    await expectPathname(router, `/threads/${threadTwo.id}`);
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
    expect(router.state.location.pathname).toBe('/new');
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
    await expectPathname(router, `/threads/${newThread.id}`);
    await waitFor(() => expect(captured.sent).toEqual(['Hello draft']));
    await waitFor(() => expect(document.body).toHaveTextContent('Hello draft'));
  });

  it('when clicking the new-thread button in the sidebar, then it navigates to the /new draft page without persisting a thread', async () => {
    const captured = useAgentControllerHandlers();
    const { router } = renderRoutes(`/threads/${threadOne.id}`);

    await waitFor(() => expect(screen.getByText('Reply from thread one')).toBeInTheDocument());

    await userEvent.click(await screen.findByRole('button', { name: 'New thread' }));

    await expectPathname(router, '/new');
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

    await expectPathname(router, `/threads/${threadTwo.id}`);
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

    await act(() => router.navigate(`/threads/${threadTwo.id}`));
    await expectPathname(router, `/threads/${threadTwo.id}`);
    await waitFor(() => expect(captured.switched).toContain(threadTwo.id));

    await act(() => router.navigate(`/threads/${threadOne.id}`));
    await expectPathname(router, `/threads/${threadOne.id}`);
    await waitFor(() => expect(screen.getByText('Reply from thread one')).toBeInTheDocument());

    await act(() => delay(200));
    expect(router.state.location.pathname).toBe(`/threads/${threadOne.id}`);
    expect(screen.getByText('Reply from thread one')).toBeInTheDocument();
    expect(screen.queryByText('Reply from thread two')).not.toBeInTheDocument();
  });

  it('when deleting the thread of the current page, then the URL returns to /new', async () => {
    const captured = useAgentControllerHandlers();
    const { router } = renderRoutes(`/threads/${threadOne.id}`);

    await waitFor(() => expect(screen.getByText('Reply from thread one')).toBeInTheDocument());
    // The thread page must survive bootstrap — no wildcard redirect to /new.
    expect(router.state.location.pathname).toBe(`/threads/${threadOne.id}`);

    const row = (await screen.findByText('First thread')).closest('[role="listitem"]') as HTMLElement;
    await userEvent.click(within(row).getByRole('button', { name: 'Thread actions' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Delete' }));

    await waitFor(() => expect(captured.deleted).toContain(threadOne.id));
    await expectPathname(router, '/new');
  });

  it('given an invalid thread deep link in the current scope, then it reports the failure and returns to /new', async () => {
    const captured = useAgentControllerHandlers({ failSwitchFor: ['nope'] });
    const { router } = renderRoutes('/threads/nope');

    await expectPathname(router, '/new');
    expect(await screen.findByRole('heading', { name: 'What do you want to work on?' })).toBeInTheDocument();
    expect(screen.getByText('Failed to switch thread: thread nope was not found')).toBeInTheDocument();
    expect(captured.switched).not.toContain('nope');
  });
});
