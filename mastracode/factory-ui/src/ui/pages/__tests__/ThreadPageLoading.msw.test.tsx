import type { AgentControllerThreadInfo, MastraDBMessage } from '@mastra/client-js';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { listedRepository } from '../../../../e2e/ui/factory-projects';
import { queryKeys } from '../../../api/keys';
import { server } from '../../../../e2e/ui/msw-server';
import { findPageHeader, renderWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '../../../../e2e/ui/render';
import { createAppRoutes } from '../../router';
import type { FactoryUserSession } from '../../domains/workspaces/services/user-sessions';
import { assistantOnlyThreadMessages, threadRailMessagesWithEcho } from './fixtures/thread-rail';

const FACTORY_ID = 'fp-1';
const REPO_ID = 'ghp-1';
const SESSION_ID = 'sess-1';
const ROUTE_THREAD_ID = 'thread-2';
const AC = `${TEST_BASE_URL}/api/agent-controller/code`;

const userSession: FactoryUserSession = {
  id: 'row-1',
  sessionId: SESSION_ID,
  projectRepositoryId: REPO_ID,
  orgId: 'org-1',
  userId: 'user-1',
  visibility: 'private',
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
}: {
  initialThreadId?: string;
  threads?: AgentControllerThreadInfo[];
  messages?: MastraDBMessage[];
} = {}) {
  const sessionGate = deferred();
  const messagesGate = deferred();
  const onChanges = vi.fn();
  const onSwitchThread = vi.fn<(threadId: string) => void>();
  const sessionAnswer: { status: 200 | 404 | 500 } = { status: 200 };
  let activeThreadId = initialThreadId;

  server.use(
    http.get(`${TEST_BASE_URL}/auth/me`, () =>
      HttpResponse.json({ authenticated: true, authEnabled: true, user: { userId: 'user-1' } }),
    ),
    http.get(`${TEST_BASE_URL}/web/config/default-model`, () =>
      HttpResponse.json({ modelId: null, thinkingLevel: null }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
      HttpResponse.json({
        projects: [
          {
            id: FACTORY_ID,
            name: 'Acme Factory',
            repositories: [listedRepository(REPO_ID, 'acme/app', { branch: 'main', sandboxWorkdir: '/repo' })],
          },
        ],
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items`, () =>
      HttpResponse.json({ workItems: [] }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}`, () =>
      HttpResponse.json({ project: { id: FACTORY_ID, name: 'Acme Factory', defaultModelId: 'openai/gpt-4o-mini' } }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/sessions`, () =>
      HttpResponse.json({ sessions: [userSession] }),
    ),
    http.get(`${TEST_BASE_URL}/web/github/subscriptions`, () => HttpResponse.json({ subscriptions: [] })),
    http.get(`${TEST_BASE_URL}/web/user-sessions/${SESSION_ID}`, async () => {
      await sessionGate.promise;
      if (sessionAnswer.status === 200) return HttpResponse.json({ session: userSession });
      return HttpResponse.json({ error: 'Session lookup failed' }, { status: sessionAnswer.status });
    }),
    http.post(`${AC}/sessions`, () =>
      HttpResponse.json({ controllerId: 'code', resourceId: SESSION_ID, threadId: activeThreadId }),
    ),
    http.get(`${AC}/sessions/:resourceId`, () =>
      HttpResponse.json({
        controllerId: 'code',
        resourceId: SESSION_ID,
        modeId: 'build',
        modelId: 'openai/gpt-4o-mini',
        threadId: activeThreadId,
        settings: { yolo: false, thinkingLevel: 'medium', notifications: 'bell', smartEditing: true },
      }),
    ),
    http.post(`${AC}/sessions/:resourceId/thread`, async ({ request }) => {
      const body: unknown = await request.json();
      if (typeof body === 'object' && body !== null && 'threadId' in body && typeof body.threadId === 'string') {
        activeThreadId = body.threadId;
        onSwitchThread(body.threadId);
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
    http.get(`${AC}/sessions/:resourceId/threads`, () => HttpResponse.json({ threads })),
    http.get(`${AC}/sessions/:resourceId/threads/:threadId/messages`, async () => {
      await messagesGate.promise;
      return HttpResponse.json({ messages });
    }),
    http.get(`${TEST_BASE_URL}/web/workspace/rendered/list`, () =>
      HttpResponse.json({ workspacePath: `/ws/${SESSION_ID}`, root: '.artifacts', rootPath: '', entries: [] }),
    ),
    http.get(`${TEST_BASE_URL}/web/workspace/changes`, () => {
      onChanges();
      return HttpResponse.json({ workspacePath: SESSION_ID, available: true, changes: [] });
    }),
  );

  return { sessionGate, messagesGate, onChanges, onSwitchThread, sessionAnswer };
}

function renderThreadRoute(path = `/factories/${FACTORY_ID}/user/threads/${SESSION_ID}`) {
  const router = createMemoryRouter(createAppRoutes(), {
    initialEntries: [path],
  });
  return renderWithProviders(<RouterProvider router={router} />);
}

describe('ThreadPage loading shell', () => {
  afterEach(() => vi.restoreAllMocks());

  it.each([
    `/factories/${FACTORY_ID}/user/threads/${SESSION_ID}`,
    `/factories/${FACTORY_ID}/workspaces/${SESSION_ID}/threads/${SESSION_ID}`,
  ])('shows a typable composer and open panel while session metadata loads at %s', async path => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => new DOMRect(0, 0, 1200, 800));
    const { sessionGate, messagesGate, onChanges } = stubThreadRoute();
    const user = userEvent.setup();
    renderThreadRoute(path);

    const composer = await screen.findByRole('region', { name: 'Thread composer' });
    const textarea = within(composer).getByRole('textbox', { name: 'Message' });
    const send = within(composer).getByRole('button', { name: 'Send message' });
    const conversation = screen.getByRole('region', { name: 'Conversation' });
    expect(within(conversation).getByRole('status', { name: 'Preparing session' })).toBeInTheDocument();
    expect(conversation).not.toContainElement(composer);
    expect(screen.getByRole('region', { name: 'Sessions' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Workspace files' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('status', { name: 'Loading workspace details' })).toBeInTheDocument();
    expect(onChanges).not.toHaveBeenCalled();
    expect(send).toBeDisabled();
    await user.type(textarea, 'Draft written while opening the session');

    // Panel details and chat history resolve independently; neither remounts the input.
    sessionGate.resolve();
    expect(await screen.findByRole('button', { name: 'Files' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Message' })).toBe(textarea);
    expect(textarea).toHaveValue('Draft written while opening the session');
    expect(send).toBeDisabled();
    expect(screen.getByRole('status', { name: 'Preparing session' })).toBeInTheDocument();
    messagesGate.resolve();
    await waitFor(() => expect(send).toBeEnabled());
    expect(screen.getByRole('textbox', { name: 'Message' })).toBe(textarea);
    expect(textarea).toHaveValue('Draft written while opening the session');
    expect(screen.queryByRole('status', { name: 'Preparing session' })).not.toBeInTheDocument();
    // The dock opened by default, so it leaves an idle sandbox asleep.
    expect(onChanges).not.toHaveBeenCalled();
  });

  it('keeps the session header and its workspace toggle mounted while thread messages load', async () => {
    const { sessionGate, messagesGate } = stubThreadRoute();
    renderThreadRoute();
    sessionGate.resolve();

    const header = await findPageHeader();
    expect(await screen.findByRole('status', { name: 'Preparing session' })).toBeInTheDocument();
    expect(within(header).getByRole('button', { name: 'Workspace files' })).toBeInTheDocument();

    messagesGate.resolve();
    await waitFor(() => expect(screen.queryByRole('status', { name: 'Preparing session' })).not.toBeInTheDocument());
    expect(await findPageHeader()).toBeInTheDocument();
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

  it('waits for sandbox readiness before synchronizing an existing route thread', async () => {
    const { sessionGate, onSwitchThread } = stubThreadRoute({
      initialThreadId: 'thread-1',
      threads: [{ id: 'thread-1' }, { id: ROUTE_THREAD_ID }],
    });
    renderThreadRoute(`/factories/${FACTORY_ID}/workspaces/${SESSION_ID}/threads/${ROUTE_THREAD_ID}`);

    expect(await screen.findByRole('status', { name: 'Preparing session' })).toBeInTheDocument();
    expect(onSwitchThread).not.toHaveBeenCalled();

    sessionGate.resolve();
    await waitFor(() => expect(onSwitchThread).toHaveBeenCalledWith(ROUTE_THREAD_ID));
  });
});

describe('ThreadPage when reading the session fails', () => {
  afterEach(() => vi.restoreAllMocks());

  it('keeps a draft typed while the session loads through a failed read and its retry', async () => {
    const { sessionGate, messagesGate, sessionAnswer } = stubThreadRoute();
    sessionAnswer.status = 500;
    messagesGate.resolve();
    const user = userEvent.setup();
    renderThreadRoute();

    await user.type(await screen.findByRole('textbox', { name: 'Message' }), 'Draft written while opening the session');
    sessionGate.resolve();

    expect(await screen.findByText(/Failed to load session \(500\)/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Start a new session' })).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Message' })).toHaveValue('Draft written while opening the session');

    sessionAnswer.status = 200;
    await user.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Send message' })).toBeEnabled());
    expect(screen.queryByText(/Failed to load session/)).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Message' })).toHaveValue('Draft written while opening the session');
  });

  it('keeps the open session, its transcript and draft when refreshing the session fails', async () => {
    const { sessionGate, messagesGate, sessionAnswer } = stubThreadRoute({ messages: threadRailMessagesWithEcho });
    sessionGate.resolve();
    messagesGate.resolve();
    const user = userEvent.setup();
    const { client } = renderThreadRoute();
    expect(await screen.findByText('Run the focused checks')).toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: 'Message' }), 'Draft in progress');

    sessionAnswer.status = 500;
    await act(() => client.invalidateQueries({ queryKey: queryKeys.userSession(SESSION_ID) }));
    await waitForMutationsIdle(client);

    expect(screen.queryByText(/Failed to load session/)).not.toBeInTheDocument();
    expect(screen.getByText('Run the focused checks')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Message' })).toHaveValue('Draft in progress');
  });

  it('leaves for the not-found page when refreshing finds the session gone', async () => {
    const { sessionGate, messagesGate, sessionAnswer } = stubThreadRoute({ messages: threadRailMessagesWithEcho });
    sessionGate.resolve();
    messagesGate.resolve();
    const { client } = renderThreadRoute();
    expect(await screen.findByText('Run the focused checks')).toBeInTheDocument();

    sessionAnswer.status = 404;
    await act(() => client.invalidateQueries({ queryKey: queryKeys.userSession(SESSION_ID) }));

    expect(await screen.findByRole('heading', { name: 'Session not found' })).toBeInTheDocument();
  });

  it('offers no workspace panel on a workspace route the viewer cannot read', async () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => new DOMRect(0, 0, 1200, 800));
    const { sessionGate, messagesGate, sessionAnswer } = stubThreadRoute();
    sessionAnswer.status = 404;
    sessionGate.resolve();
    messagesGate.resolve();
    renderThreadRoute(`/factories/${FACTORY_ID}/workspaces/${SESSION_ID}/threads/${SESSION_ID}`);

    expect(await screen.findByText(/not found or is private to another user/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Workspace files' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('workspace-files-card')).not.toBeInTheDocument();
  });
});
