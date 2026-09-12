import type { AgentControllerSessionState, AgentControllerThreadInfo, MastraDBMessage } from '@mastra/client-js';
import { act, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../e2e/ui/render';
import { createAppRoutes } from '../../router';
import { assistantOnlyThreadMessages, threadRailMessagesWithEcho } from './fixtures/thread-rail';

const FACTORY_ID = 'fp-1';
const REPO_ID = 'ghp-1';
const SESSION_ID = 'sess-1';
const ROUTE_THREAD_ID = 'thread-2';
const AC = `${TEST_BASE_URL}/api/agent-controller/code`;

const userSession = {
  id: 'row-1',
  sessionId: SESSION_ID,
  projectRepositoryId: REPO_ID,
  orgId: 'org-1',
  userId: 'user-1',
  branch: 'user/my-feature',
  baseBranch: 'main',
  sandboxId: null,
  sandboxWorkdir: null,
  materializedAt: null,
  createdAt: '2026-07-23T00:00:00.000Z',
  updatedAt: '2026-07-23T00:00:00.000Z',
};

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(r => {
    resolve = r;
  });
  return { promise, resolve };
}

function stubThreadRoute({
  initialThreadId = SESSION_ID,
  threads = [],
  messages = [],
  tasksByThread = {},
}: {
  initialThreadId?: string;
  threads?: AgentControllerThreadInfo[];
  messages?: MastraDBMessage[];
  tasksByThread?: Record<string, AgentControllerSessionState['tasks']>;
} = {}) {
  const sessionGate = deferred();
  const messagesGate = deferred();
  let activeThreadId = initialThreadId;
  const threadIds = new Set([initialThreadId, ...threads.map(thread => thread.id)]);

  server.use(
    http.get(`${TEST_BASE_URL}/auth/me`, () =>
      HttpResponse.json({ authenticated: true, authEnabled: true, user: { userId: 'user-1' } }),
    ),
    http.get(`${TEST_BASE_URL}/web/config/model-packs`, () =>
      HttpResponse.json({ packs: [], activePackId: null, sessionPackId: null }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
      HttpResponse.json({ projects: [{ id: FACTORY_ID, name: 'Acme Factory' }] }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/source-control-connections`, () =>
      HttpResponse.json({
        connections: [
          {
            id: 'conn-1',
            installationId: 'inst-1',
            repositories: [
              {
                id: REPO_ID,
                branch: 'main',
                sandboxWorkdir: '/repo',
                repository: { slug: 'acme/app', defaultBranch: 'main' },
              },
            ],
          },
        ],
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items`, () =>
      HttpResponse.json({ workItems: [] }),
    ),
    http.get(`${TEST_BASE_URL}/web/github/projects/${REPO_ID}/sessions`, () =>
      HttpResponse.json({ sessions: [userSession] }),
    ),
    http.get(`${TEST_BASE_URL}/web/github/subscriptions`, () => HttpResponse.json({ subscriptions: [] })),
    http.get(`${TEST_BASE_URL}/web/user-sessions/${SESSION_ID}`, async () => {
      await sessionGate.promise;
      return HttpResponse.json({ session: userSession });
    }),
    http.post(`${AC}/sessions`, async ({ request }) => {
      const body: unknown = await request.json();
      if (typeof body === 'object' && body !== null && 'threadId' in body && typeof body.threadId === 'string') {
        activeThreadId = body.threadId;
        threadIds.add(body.threadId);
      }
      return HttpResponse.json({ controllerId: 'code', resourceId: SESSION_ID, threadId: activeThreadId });
    }),
    http.get(`${AC}/sessions/:resourceId`, ({ request }) => {
      const requestedThreadId = new URL(request.url).searchParams.get('threadId');
      if (requestedThreadId && !threadIds.has(requestedThreadId)) {
        return HttpResponse.json({ error: 'Thread not found' }, { status: 404 });
      }
      if (requestedThreadId && requestedThreadId !== activeThreadId) {
        return HttpResponse.json({ error: 'Thread is not active in this session' }, { status: 409 });
      }
      return HttpResponse.json({
        controllerId: 'code',
        resourceId: SESSION_ID,
        modeId: 'build',
        modelId: 'openai/gpt-4o-mini',
        threadId: activeThreadId,
        tasks: tasksByThread[activeThreadId],
        settings: { yolo: false, thinkingLevel: 'medium', notifications: 'bell', smartEditing: true },
      });
    }),
    http.post(`${AC}/sessions/:resourceId/thread`, async ({ request }) => {
      const body: unknown = await request.json();
      if (typeof body === 'object' && body !== null && 'threadId' in body && typeof body.threadId === 'string') {
        if (!threadIds.has(body.threadId)) {
          return HttpResponse.json({ error: 'Thread not found' }, { status: 404 });
        }
        activeThreadId = body.threadId;
      }
      return HttpResponse.json({ ok: true });
    }),
    http.put(`${AC}/sessions/:resourceId/state`, () => HttpResponse.json({ ok: true })),
    http.get(
      `${AC}/sessions/:resourceId/stream`,
      () =>
        new Response(new ReadableStream<Uint8Array>({ start() {}, cancel() {} }), {
          headers: { 'content-type': 'text/event-stream' },
        }),
    ),
    http.get(`${AC}/sessions/:resourceId/permissions`, () => HttpResponse.json({})),
    http.get(`${AC}/sessions/:resourceId/threads`, () =>
      HttpResponse.json({ threads: [...threadIds].map(id => ({ id })) }),
    ),
    http.get(`${AC}/sessions/:resourceId/threads/:threadId/messages`, async () => {
      await messagesGate.promise;
      return HttpResponse.json({ messages });
    }),
    http.get(`${AC}/modes`, () => HttpResponse.json({ modes: [] })),
    http.get(`${TEST_BASE_URL}/web/workspace/rendered/list`, () =>
      HttpResponse.json({ workspacePath: `/ws/${SESSION_ID}`, root: '.artifacts', rootPath: '', entries: [] }),
    ),
  );

  return { sessionGate, messagesGate, getActiveThreadId: () => activeThreadId, getThreadIds: () => [...threadIds] };
}

function renderThreadRoute(path = `/factories/${FACTORY_ID}/user/threads/${SESSION_ID}`) {
  const router = createMemoryRouter(createAppRoutes(), {
    initialEntries: [path],
  });
  return { ...renderWithProviders(<RouterProvider router={router} />), router };
}

describe('ThreadPage loading shell', () => {
  it('keeps the sidebar mounted with a main-slot spinner while the session resolves, then shows the thread', async () => {
    const { sessionGate, messagesGate } = stubThreadRoute();
    messagesGate.resolve();
    renderThreadRoute();

    expect(await screen.findByLabelText('Loading session')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'User sessions' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New user session' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Thread composer' })).not.toBeInTheDocument();

    sessionGate.resolve();
    expect(await screen.findByRole('region', { name: 'Thread composer' })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByLabelText('Loading session')).not.toBeInTheDocument());
    expect(screen.getByRole('region', { name: 'User sessions' })).toBeInTheDocument();
  });

  it('keeps the session header and its workspace toggle mounted while thread messages load', async () => {
    const { sessionGate, messagesGate } = stubThreadRoute();
    renderThreadRoute();
    sessionGate.resolve();

    const header = await screen.findByRole('region', { name: 'Factory session' });
    expect(await screen.findByRole('status', { name: 'Preparing session' })).toBeInTheDocument();
    expect(within(header).getByRole('button', { name: 'Workspace files' })).toBeInTheDocument();

    messagesGate.resolve();
    await waitFor(() => expect(screen.queryByRole('status', { name: 'Preparing session' })).not.toBeInTheDocument());
    expect(screen.getByRole('region', { name: 'Factory session' })).toBeInTheDocument();
  });

  it('reveals loaded history without briefly rendering the empty thread state', async () => {
    const { sessionGate, messagesGate } = stubThreadRoute({ messages: assistantOnlyThreadMessages });
    renderThreadRoute();
    sessionGate.resolve();
    await screen.findByRole('status', { name: 'Preparing session' });

    let renderedEmptyState = false;
    const observer = new MutationObserver(records => {
      renderedEmptyState ||= records.some(record =>
        Array.from(record.addedNodes).some(node => node.textContent?.includes('What can I help you build?')),
      );
    });
    observer.observe(document.body, { childList: true, subtree: true });

    messagesGate.resolve();
    await screen.findByText('There are no user turns in this thread.');
    observer.disconnect();

    expect(renderedEmptyState).toBe(false);
  });

  it('reveals the complete loaded transcript when preparation finishes', async () => {
    const { sessionGate, messagesGate } = stubThreadRoute({ messages: threadRailMessagesWithEcho });
    renderThreadRoute();
    sessionGate.resolve();
    await screen.findByRole('status', { name: 'Preparing session' });

    messagesGate.resolve();
    await screen.findByText('Run the focused checks');

    expect(screen.getByText('Review the implementation plan')).toBeInTheDocument();
    expect(document.body).toHaveTextContent('The implementation is ready to review.');
    expect(screen.queryByRole('status', { name: 'Preparing session' })).not.toBeInTheDocument();
  });

  it('binds the route thread only after its session metadata resolves', async () => {
    const { sessionGate, getActiveThreadId } = stubThreadRoute({
      initialThreadId: 'thread-1',
      threads: [{ id: 'thread-1' }, { id: ROUTE_THREAD_ID }],
    });
    renderThreadRoute(`/factories/${FACTORY_ID}/workspaces/${SESSION_ID}/threads/${ROUTE_THREAD_ID}`);

    expect(await screen.findByRole('status', { name: 'Preparing session' })).toBeInTheDocument();
    expect(getActiveThreadId()).toBe('thread-1');

    sessionGate.resolve();
    await waitFor(() => expect(getActiveThreadId()).toBe(ROUTE_THREAD_ID));
  });

  it('does not recreate a deleted thread when its saved URL is opened', async () => {
    const session = stubThreadRoute({ initialThreadId: 'previous-thread' });
    session.sessionGate.resolve();
    session.messagesGate.resolve();
    const { router } = renderThreadRoute(`/factories/${FACTORY_ID}/workspaces/${SESSION_ID}/threads/deleted-thread`);

    await waitFor(() => expect(router.state.location.pathname).toBe(`/factories/${FACTORY_ID}/new`));
    expect(session.getThreadIds()).toEqual(['previous-thread']);
    expect(session.getActiveThreadId()).toBe('previous-thread');
  });

  it('rebinds the requested thread when navigating A to B and back to A', async () => {
    const session = stubThreadRoute({
      initialThreadId: 'thread-a',
      threads: [{ id: 'thread-a' }, { id: 'thread-b' }],
      tasksByThread: {
        'thread-a': [{ id: 'a', content: 'Task from A', status: 'pending', activeForm: 'Working on A' }],
        'thread-b': [{ id: 'b', content: 'Task from B', status: 'pending', activeForm: 'Working on B' }],
      },
    });
    session.sessionGate.resolve();
    session.messagesGate.resolve();
    const { router } = renderThreadRoute(`/factories/${FACTORY_ID}/workspaces/${SESSION_ID}/threads/thread-a`);
    await screen.findByText('Task from A');

    await act(() => router.navigate(`/factories/${FACTORY_ID}/workspaces/${SESSION_ID}/threads/thread-b`));
    await screen.findByText('Task from B');
    expect(screen.queryByText('Task from A')).not.toBeInTheDocument();

    await act(() => router.navigate(-1));
    await screen.findByText('Task from A');
    expect(screen.queryByText('Task from B')).not.toBeInTheDocument();
    expect(session.getActiveThreadId()).toBe('thread-a');
    expect(screen.getByRole('textbox', { name: 'Message' })).toBeEnabled();
  });
});
