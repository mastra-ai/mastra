import type { AgentControllerEvent } from '@mastra/client-js';
import type { MastraDBMessage } from '@mastra/core/agent-controller';
import { act, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '../../../../e2e/ui/render';
import { createAppRoutes } from '../../router';
import { queryKeys } from '../../../api/keys';

const FACTORY_ID = 'fp-1';
const REPO_ID = 'ghp-1';
const SESSION_ID = 'sess-1';
const AC = `${TEST_BASE_URL}/api/agent-controller/code`;

const userSession = {
  id: 'row-1',
  sessionId: SESSION_ID,
  projectRepositoryId: REPO_ID,
  orgId: 'org-1',
  userId: 'user-1',
  branch: 'factory/pr-1',
  baseBranch: 'main',
  sandboxId: null,
  sandboxWorkdir: null,
  materializedAt: null,
  createdAt: '2026-07-23T00:00:00.000Z',
  updatedAt: '2026-07-23T00:00:00.000Z',
};

function dbMessage(id: string, role: MastraDBMessage['role'], text: string): MastraDBMessage {
  return {
    id,
    role,
    createdAt: new Date('2026-07-23T00:00:00.000Z'),
    content: { format: 2, parts: [{ type: 'text', text }] },
  };
}

/** Thread transcript as the server holds it; the test grows it mid-run. */
function stubThreadRoute(initialMessages: MastraDBMessage[]) {
  let messages = initialMessages;
  const streams = new Set<ReadableStreamDefaultController<Uint8Array>>();

  server.use(
    http.get(`${TEST_BASE_URL}/auth/me`, () =>
      HttpResponse.json({ authenticated: true, authEnabled: true, user: { userId: 'user-1' } }),
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
    http.get(`${TEST_BASE_URL}/web/user-sessions/${SESSION_ID}`, () => HttpResponse.json({ session: userSession })),
    http.post(`${AC}/sessions`, () =>
      HttpResponse.json({ controllerId: 'code', resourceId: SESSION_ID, threadId: SESSION_ID }),
    ),
    http.get(`${AC}/sessions/:resourceId`, () =>
      HttpResponse.json({
        controllerId: 'code',
        resourceId: SESSION_ID,
        modeId: 'build',
        modelId: 'openai/gpt-4o-mini',
        threadId: SESSION_ID,
        settings: { yolo: false, thinkingLevel: 'medium', notifications: 'bell', smartEditing: true },
      }),
    ),
    http.post(`${AC}/sessions/:resourceId/thread`, () => HttpResponse.json({ ok: true })),
    http.put(`${AC}/sessions/:resourceId/state`, () => HttpResponse.json({ ok: true })),
    http.get(
      `${AC}/sessions/:resourceId/stream`,
      () =>
        new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              streams.add(controller);
            },
            cancel() {
              streams.clear();
            },
          }),
          {
            headers: { 'content-type': 'text/event-stream' },
          },
        ),
    ),
    http.get(`${AC}/sessions/:resourceId/permissions`, () => HttpResponse.json({})),
    http.get(`${AC}/sessions/:resourceId/threads`, () => HttpResponse.json({ threads: [{ id: SESSION_ID }] })),
    http.get(`${AC}/sessions/:resourceId/threads/:threadId/messages`, ({ request }) => {
      const limit = Number(new URL(request.url).searchParams.get('limit'));
      return HttpResponse.json({ messages: messages.slice(Math.max(0, messages.length - limit)) });
    }),
    http.get(`${AC}/modes`, () => HttpResponse.json({ modes: [] })),
    http.get(`${TEST_BASE_URL}/web/workspace/rendered/list`, () =>
      HttpResponse.json({ workspacePath: `/ws/${SESSION_ID}`, root: '.artifacts', rootPath: '', entries: [] }),
    ),
  );

  return {
    runProduces: (next: MastraDBMessage[]) => (messages = [...messages, ...next]),
    connected: () => streams.size > 0,
    emit: (event: AgentControllerEvent) => {
      for (const stream of streams) stream.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`));
    },
  };
}

const THREAD_PATH = `/factories/${FACTORY_ID}/workspaces/${SESSION_ID}/threads/${SESSION_ID}`;

describe('ThreadPage revisit', () => {
  it('shows messages the run produced while the route was elsewhere', async () => {
    const { runProduces } = stubThreadRoute([dbMessage('kickoff', 'user', 'review this PR')]);
    const router = createMemoryRouter(createAppRoutes(), { initialEntries: [THREAD_PATH] });
    const { client } = renderWithProviders(<RouterProvider router={router} />);

    expect(await screen.findByText('review this PR')).toBeInTheDocument();
    await waitForMutationsIdle(client);

    await router.navigate(`/factories/${FACTORY_ID}/work`);
    await waitFor(() => expect(screen.queryByText('review this PR')).not.toBeInTheDocument());

    // The agent keeps working with nobody subscribed to the stream.
    runProduces([
      dbMessage('reply-1', 'assistant', 'reading the diff'),
      dbMessage('reply-2', 'assistant', 'here is the review'),
    ]);

    await router.navigate(THREAD_PATH);
    await waitForMutationsIdle(client);

    expect(await screen.findByText('here is the review')).toBeInTheDocument();
    expect(screen.getByText('reading the diff')).toBeInTheDocument();
    expect(screen.getByText('review this PR')).toBeInTheDocument();
  });
});

describe('ThreadPage session error history', () => {
  it('reconciles live SSE errors with fetched history in order, then restores them on a fresh client', async () => {
    const serverThread = stubThreadRoute([]);
    const router = createMemoryRouter(createAppRoutes(), { initialEntries: [THREAD_PATH] });
    const { client, unmount } = renderWithProviders(<RouterProvider router={router} />);
    await waitForMutationsIdle(client);
    await waitFor(() => expect(serverThread.connected()).toBe(true));
    const emitFailure = (occurrenceId: string) =>
      serverThread.emit({ type: 'error', occurrenceId, error: { name: 'Error', message: 'The provider failed.' } });
    await act(async () => {
      emitFailure('first');
    });
    expect(await screen.findByText('The provider failed.')).toBeInTheDocument();
    const failureMessage = (occurrenceId: string): MastraDBMessage => ({
      id: `stored-${occurrenceId}`,
      role: 'assistant',
      createdAt: new Date('2026-09-09T08:00:00Z'),
      content: {
        format: 2,
        parts: [{ type: 'data-session-error', data: { occurrenceId, name: 'Error', message: 'The provider failed.' } }],
      },
    });
    serverThread.runProduces([dbMessage('before', 'user', 'Please try the provider'), failureMessage('first')]);
    const refresh = () =>
      client.invalidateQueries({ queryKey: queryKeys.agentControllerThreadMessages('code', SESSION_ID, SESSION_ID) });
    await act(async () => {
      await refresh();
    });
    await waitForMutationsIdle(client);
    const before = await screen.findByText('Please try the provider');
    const first = screen.getByText('The provider failed.');
    expect(before.compareDocumentPosition(first) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getAllByText('The provider failed.')).toHaveLength(1);
    await act(async () => {
      emitFailure('first');
      emitFailure('second');
    });
    await waitFor(() => expect(screen.getAllByText('The provider failed.')).toHaveLength(2));
    serverThread.runProduces([failureMessage('second'), dbMessage('after', 'assistant', 'Recovered successfully')]);
    await act(async () => {
      await refresh();
    });
    await waitForMutationsIdle(client);
    expect(screen.getAllByText('The provider failed.')).toHaveLength(2);
    expect(await screen.findByText('Recovered successfully')).toBeInTheDocument();
    unmount();
    client.clear();
    const freshRouter = createMemoryRouter(createAppRoutes(), { initialEntries: [THREAD_PATH] });
    const fresh = renderWithProviders(<RouterProvider router={freshRouter} />);
    await waitForMutationsIdle(fresh.client);
    expect(await screen.findAllByText('The provider failed.')).toHaveLength(2);
    const restored = screen.getAllByText('The provider failed.');
    expect(
      screen.getByText('Please try the provider').compareDocumentPosition(restored[0]!) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      restored[1]!.compareDocumentPosition(screen.getByText('Recovered successfully')) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
