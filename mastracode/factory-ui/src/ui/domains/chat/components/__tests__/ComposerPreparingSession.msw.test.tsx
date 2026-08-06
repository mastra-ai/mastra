import type { QueryClient } from '@tanstack/react-query';
import { MainSidebarProvider } from '@mastra/playground-ui/components/MainSidebar';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import assert from 'node:assert';
import { Link, MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders, waitForMutationsIdle } from '../../../../../../e2e/ui/render';
import { OverlaysProvider } from '../../../../lib/overlays';
import { ChatSessionTestProvider } from '../../context/ChatSessionTestProvider';
import { useThreadPageKickoffs } from '../../hooks/useThreadPageKickoffs';
import { Composer, PREPARING_SESSION_TIMEOUT_MS } from '../Composer';
import { Transcript } from '../Transcript';

if (typeof globalThis.Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

const API = `${TEST_BASE_URL}/api/agent-controller/code`;
const FACTORY_ID = 'fp-preparing';
const PROJECT_REPOSITORY_ID = 'repo-preparing';
const SESSION_ID = 'sess-preparing';

interface PreparingSession {
  finishWorkspace: () => void;
  finishFirstDispatch: () => void;
  sentMessages: string[];
  steerAttempts: number;
}

interface StubPreparingSessionOptions {
  failDispatch?: boolean;
  failWorkspace?: boolean;
  holdFirstDispatch?: boolean;
  materialized?: boolean;
}

function readSentMessage(body: unknown): string {
  if (typeof body !== 'object' || body === null) return '';
  if ('message' in body && typeof body.message === 'string') return body.message;
  return '';
}

function stubPreparingSession({
  failDispatch = false,
  failWorkspace = false,
  holdFirstDispatch = false,
  materialized = false,
}: StubPreparingSessionOptions = {}): PreparingSession {
  let releaseWorkspace = () => {};
  const workspaceReady = new Promise<void>(resolve => {
    releaseWorkspace = resolve;
  });
  let releaseFirstDispatch = () => {};
  const firstDispatchFinished = new Promise<void>(resolve => {
    releaseFirstDispatch = resolve;
  });
  let sse: ReadableStreamDefaultController<Uint8Array> | null = null;
  const sentMessages: string[] = [];
  const result: PreparingSession = {
    finishWorkspace: releaseWorkspace,
    finishFirstDispatch: releaseFirstDispatch,
    sentMessages,
    steerAttempts: 0,
  };

  server.use(
    http.get(`${TEST_BASE_URL}/auth/me`, () =>
      HttpResponse.json({ authenticated: true, user: { userId: 'user-1', email: 'user@example.com' } }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
      HttpResponse.json({ projects: [{ id: FACTORY_ID, name: 'Preparing' }] }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/:factoryProjectId/source-control-connections`, () =>
      HttpResponse.json({
        connections: [
          {
            id: 'conn-1',
            installationId: 'inst-1',
            repositories: [
              {
                id: PROJECT_REPOSITORY_ID,
                branch: 'main',
                sandboxWorkdir: '/workspace/preparing',
                repository: { slug: 'octo/hello', defaultBranch: 'main' },
              },
            ],
          },
        ],
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/user-sessions/:sessionId`, () =>
      HttpResponse.json({
        session: {
          id: 'row-1',
          sessionId: SESSION_ID,
          projectRepositoryId: PROJECT_REPOSITORY_ID,
          orgId: 'org-1',
          userId: 'user-1',
          branch: 'user/session-1',
          baseBranch: 'main',
          sandboxId: null,
          sandboxWorkdir: null,
          materializedAt: materialized ? '2026-07-23T00:00:00.000Z' : null,
          createdAt: '2026-07-23T00:00:00.000Z',
          updatedAt: '2026-07-23T00:00:00.000Z',
        },
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/github/projects/:projectRepositoryId/sessions`, () =>
      HttpResponse.json({ sessions: [] }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/:factoryProjectId/work-items`, () =>
      HttpResponse.json({ workItems: [] }),
    ),
    http.get(`${TEST_BASE_URL}/web/github/subscriptions`, () => HttpResponse.json({ subscriptions: [] })),
    http.post(`${TEST_BASE_URL}/web/github/projects/:projectRepositoryId/ensure`, () =>
      HttpResponse.json({ resourceId: SESSION_ID, sandboxId: null, sandboxWorkdir: '/workspace/preparing' }),
    ),
    http.post(`${API}/sessions`, async () => {
      await workspaceReady;
      if (failWorkspace) return HttpResponse.json({ message: 'Clone failed' }, { status: 500 });
      return HttpResponse.json({ controllerId: 'code', resourceId: SESSION_ID, threadId: SESSION_ID });
    }),
    http.get(`${API}/modes`, () => HttpResponse.json({ modes: [{ id: 'build', label: 'Build' }] })),
    http.get(`${API}/models`, () =>
      HttpResponse.json({
        models: [
          { id: 'openai/gpt-4o-mini', provider: 'openai', modelName: 'gpt-4o-mini', hasApiKey: true, useCount: 1 },
        ],
      }),
    ),
    http.get(`${API}/sessions/:resourceId`, ({ params }) =>
      HttpResponse.json({
        controllerId: 'code',
        resourceId: params.resourceId,
        modeId: 'build',
        modelId: 'openai/gpt-4o-mini',
        threadId: SESSION_ID,
        settings: { yolo: false, thinkingLevel: 'medium', notifications: 'bell', smartEditing: true },
      }),
    ),
    http.get(`${API}/sessions/:resourceId/permissions`, () =>
      HttpResponse.json({ categories: { read: 'ask' }, tools: {} }),
    ),
    http.get(`${API}/sessions/:resourceId/threads`, () => HttpResponse.json({ threads: [] })),
    http.get(`${API}/sessions/:resourceId/threads/:threadId/messages`, () => HttpResponse.json({ messages: [] })),
    http.get(
      `${API}/sessions/:resourceId/stream`,
      () =>
        new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              sse = controller;
            },
            cancel() {},
          }),
          {
            headers: { 'content-type': 'text/event-stream' },
          },
        ),
    ),
    http.put(`${API}/sessions/:resourceId/state`, () => HttpResponse.json({})),
    http.post(`${API}/sessions/:resourceId/messages`, async ({ request }) => {
      sentMessages.push(readSentMessage(await request.json()));
      if (holdFirstDispatch && sentMessages.length === 1) await firstDispatchFinished;
      if (failDispatch) return HttpResponse.json({ message: 'Sandbox is gone' }, { status: 500 });
      // real dispatch runs an agent turn; agent_end is what releases the pending latch
      sse?.enqueue(new TextEncoder().encode('data: {"type":"agent_end"}\n\n'));
      return HttpResponse.json({ ok: true });
    }),
    http.post(`${API}/sessions/:resourceId/steer`, () => {
      result.steerAttempts += 1;
      return HttpResponse.json({ ok: true });
    }),
  );

  return result;
}

async function releaseSession(finishWorkspace: () => void, client: QueryClient) {
  finishWorkspace();
  await waitForMutationsIdle(client);
  await waitFor(() => expect(screen.queryByText('Preparing workspace…')).not.toBeInTheDocument());
}

function ThreadSurface() {
  useThreadPageKickoffs();
  return (
    <>
      <Link to="/away">go-away</Link>
      <Transcript />
      <Composer />
    </>
  );
}

function renderThread() {
  return renderWithProviders(
    <MemoryRouter initialEntries={[`/factories/${FACTORY_ID}/user/threads/${SESSION_ID}`]}>
      <Routes>
        <Route
          path="/factories/:factoryId/user/threads/:threadId"
          element={
            <MainSidebarProvider storageKey="preparing-test">
              <ChatSessionTestProvider threadId={SESSION_ID} userScoped deferUntilMessagesReady={false}>
                <OverlaysProvider>
                  <ThreadSurface />
                </OverlaysProvider>
              </ChatSessionTestProvider>
            </MainSidebarProvider>
          }
        />
        <Route
          path="/away"
          element={<Link to={`/factories/${FACTORY_ID}/user/threads/${SESSION_ID}`}>go-thread</Link>}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Composer while a session prepares its workspace', () => {
  it('takes the first message, shows it, and sends it once the session is online', async () => {
    const session = stubPreparingSession();
    const user = userEvent.setup();

    const { client } = renderThread();

    const message = () => screen.getByRole('textbox', { name: 'Message' });
    await waitFor(() => expect(message()).toBeEnabled());
    await waitFor(() => expect(screen.getByText('Preparing workspace…')).toBeInTheDocument());

    await user.type(message(), 'fix the login bug');
    await user.keyboard('{Enter}');

    await waitFor(() => expect(screen.getByText('fix the login bug')).toBeInTheDocument());
    expect(session.sentMessages).toEqual([]);

    session.finishWorkspace();
    await waitForMutationsIdle(client);

    await waitFor(() => expect(session.sentMessages).toEqual(['fix the login bug']));
    expect(screen.getAllByText('fix the login bug')).toHaveLength(1);

    await user.type(message(), 'follow up');
    await user.keyboard('{Enter}');
    await waitForMutationsIdle(client);

    await waitFor(() => expect(session.sentMessages).toEqual(['fix the login bug', 'follow up']));
    expect(session.steerAttempts).toBe(0);
  });

  it('re-echoes a queued message after navigating away and back while the session prepares', async () => {
    const session = stubPreparingSession();
    const user = userEvent.setup();

    const { client } = renderThread();

    const message = () => screen.getByRole('textbox', { name: 'Message' });
    await waitFor(() => expect(message()).toBeEnabled());
    await waitFor(() => expect(screen.getByText('Preparing workspace…')).toBeInTheDocument());

    await user.type(message(), 'fix the login bug');
    await user.keyboard('{Enter}');
    await waitFor(() => expect(screen.getByText('fix the login bug')).toBeInTheDocument());

    await user.click(screen.getByText('go-away'));
    expect(screen.queryByText('fix the login bug')).not.toBeInTheDocument();

    await user.click(screen.getByText('go-thread'));
    await waitFor(() => expect(screen.getByText('fix the login bug')).toBeInTheDocument());

    session.finishWorkspace();
    await waitForMutationsIdle(client);

    await waitFor(() => expect(session.sentMessages).toEqual(['fix the login bug']));
    expect(screen.getAllByText('fix the login bug')).toHaveLength(1);
    expect(session.steerAttempts).toBe(0);
  });

  it('dispatches queued messages in order without steering the offline session', async () => {
    const session = stubPreparingSession({ holdFirstDispatch: true });
    const user = userEvent.setup();

    const { client } = renderThread();

    const message = () => screen.getByRole('textbox', { name: 'Message' });
    await waitFor(() => expect(message()).toBeEnabled());
    await waitFor(() => expect(screen.getByText('Preparing workspace…')).toBeInTheDocument());

    await user.type(message(), 'fix the login bug');
    await user.keyboard('{Enter}');
    await waitFor(() => expect(screen.getByText('fix the login bug')).toBeInTheDocument());

    await user.type(message(), 'and add a test');
    await user.keyboard('{Enter}');
    await waitFor(() => expect(screen.getByText('and add a test')).toBeInTheDocument());

    expect(session.steerAttempts).toBe(0);
    expect(screen.getByText('Preparing workspace…')).toBeInTheDocument();

    session.finishWorkspace();

    await waitFor(() => expect(session.sentMessages).toEqual(['fix the login bug']));
    session.finishFirstDispatch();
    await waitForMutationsIdle(client);
    await waitFor(() => expect(session.sentMessages).toEqual(['fix the login bug', 'and add a test']));
    expect(session.steerAttempts).toBe(0);
  });

  it('says connecting, not preparing, for a session whose workspace already exists', async () => {
    const session = stubPreparingSession({ materialized: true });
    const user = userEvent.setup();

    const { client } = renderThread();

    const message = () => screen.getByRole('textbox', { name: 'Message' });
    await waitFor(() => expect(message()).toBeEnabled());
    await waitFor(() => expect(screen.getByText('Connecting…')).toBeInTheDocument());
    expect(screen.queryByText('Preparing workspace…')).not.toBeInTheDocument();

    await user.type(message(), 'fix the login bug');
    await user.keyboard('{Enter}');

    session.finishWorkspace();
    await waitForMutationsIdle(client);

    await waitFor(() => expect(session.sentMessages).toEqual(['fix the login bug']));
  });

  it('reports a failed dispatch once, not once per reporter', async () => {
    const session = stubPreparingSession({ failDispatch: true });
    const user = userEvent.setup();

    const { client } = renderThread();

    const message = () => screen.getByRole('textbox', { name: 'Message' });
    await waitFor(() => expect(message()).toBeEnabled());
    await waitFor(() => expect(screen.getByText('Preparing workspace…')).toBeInTheDocument());

    await user.type(message(), 'fix the login bug');
    await user.keyboard('{Enter}');

    session.finishWorkspace();
    await waitForMutationsIdle(client);

    await waitFor(() => expect(screen.getAllByText(/Sandbox is gone/).length).toBeGreaterThan(0));
    expect(screen.getAllByText(/Sandbox is gone/)).toHaveLength(1);
  });

  it('fails queued messages when the session cannot come online', async () => {
    const session = stubPreparingSession({ failWorkspace: true });
    const user = userEvent.setup();

    const { client } = renderThread();

    const message = () => screen.getByRole('textbox', { name: 'Message' });
    await waitFor(() => expect(message()).toBeEnabled());
    await waitFor(() => expect(screen.getByText('Preparing workspace…')).toBeInTheDocument());

    await user.type(message(), 'fix the login bug');
    await user.keyboard('{Enter}');
    session.finishWorkspace();
    await waitForMutationsIdle(client);

    await waitFor(() =>
      expect(
        screen.getByText('The session failed to come online. Reconnect, then send the message again.'),
      ).toBeInTheDocument(),
    );
    expect(screen.getAllByText('fix the login bug')).toHaveLength(1);
    expect(session.sentMessages).toEqual([]);
  });

  it('clears the pending message and reports when preparation times out', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const session = stubPreparingSession();
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const { client } = renderThread();

      const message = () => screen.getByRole('textbox', { name: 'Message' });
      await waitFor(() => expect(message()).toBeEnabled());
      await waitFor(() => expect(screen.getByText('Preparing workspace…')).toBeInTheDocument());

      await user.type(message(), 'fix the login bug');
      await user.keyboard('{Enter}');
      expect(screen.queryByRole('button', { name: 'Abort' })).not.toBeInTheDocument();
      expect(message()).toHaveAttribute('placeholder', 'Ask Mastra Code…');

      await vi.advanceTimersByTimeAsync(PREPARING_SESSION_TIMEOUT_MS + 1);

      await waitFor(() =>
        expect(
          screen.getByText('The session never came online. Send the message again once it is ready.'),
        ).toBeInTheDocument(),
      );
      expect(screen.queryByRole('button', { name: 'Abort' })).not.toBeInTheDocument();
      await releaseSession(session.finishWorkspace, client);
    } finally {
      vi.useRealTimers();
    }
  });

  it('refuses an image dropped while preparing, since a queued message carries text only', async () => {
    const { finishWorkspace, sentMessages } = stubPreparingSession();

    const { container, client } = renderThread();

    const message = () => screen.getByRole('textbox', { name: 'Message' });
    await waitFor(() => expect(message()).toBeEnabled());
    await waitFor(() => expect(screen.getByText('Preparing workspace…')).toBeInTheDocument());

    const form = container.querySelector('form');
    assert(form);
    fireEvent.drop(form, { dataTransfer: { files: [new File(['png'], 'shot.png', { type: 'image/png' })] } });

    await waitFor(() =>
      expect(screen.getByText('Images can be attached once the session is ready.')).toBeInTheDocument(),
    );
    expect(screen.queryByRole('button', { name: 'Remove image' })).not.toBeInTheDocument();
    expect(sentMessages).toEqual([]);

    await releaseSession(finishWorkspace, client);
  });

  it('keeps a slash command in the composer, since commands act on a live session', async () => {
    const { finishWorkspace, sentMessages } = stubPreparingSession();
    const user = userEvent.setup();

    const { client } = renderThread();

    const message = () => screen.getByRole('textbox', { name: 'Message' });
    await waitFor(() => expect(message()).toBeEnabled());
    await waitFor(() => expect(screen.getByText('Preparing workspace…')).toBeInTheDocument());

    await user.type(message(), '/goal ship it');
    await user.keyboard('{Enter}');

    await waitFor(() => expect(screen.getByText('Commands run once the session is ready.')).toBeInTheDocument());
    expect(message()).toHaveValue('/goal ship it');
    expect(sentMessages).toEqual([]);

    await releaseSession(finishWorkspace, client);
  });

  it('runs local slash commands while preparing', async () => {
    const { finishWorkspace, sentMessages } = stubPreparingSession();
    const user = userEvent.setup();

    const { client } = renderThread();

    const message = () => screen.getByRole('textbox', { name: 'Message' });
    await waitFor(() => expect(message()).toBeEnabled());
    await waitFor(() => expect(screen.getByText('Preparing workspace…')).toBeInTheDocument());

    await user.type(message(), '/help');
    await user.keyboard('{Enter}');

    expect(await screen.findByText(/Available commands:/)).toBeInTheDocument();
    expect(message()).toHaveValue('');
    expect(sentMessages).toEqual([]);

    await releaseSession(finishWorkspace, client);
  });
});
