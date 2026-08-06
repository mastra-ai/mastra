import type { QueryClient } from '@tanstack/react-query';
import { MainSidebarProvider } from '@mastra/playground-ui/components/MainSidebar';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import assert from 'node:assert';
import { Link, MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders, waitForMutationsIdle } from '../../../../../../e2e/ui/render';
import { OverlaysProvider } from '../../../../lib/overlays';
import { ChatSessionTestProvider } from '../../context/ChatSessionTestProvider';
import { Composer } from '../Composer';
import { Transcript } from '../Transcript';

if (typeof globalThis.Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

const API = `${TEST_BASE_URL}/api/agent-controller/code`;
const FACTORY_ID = 'fp-preparing';
const PROJECT_REPOSITORY_ID = 'repo-preparing';
const SESSION_ID = '20000000-0000-4000-8000-000000000003';

interface PreparingSession {
  finishWorkspace: () => void;
  /** Messages the browser handed to the controller, in arrival order. */
  posted: string[];
  /** Attachments carried by the last posted message. */
  postedFiles: unknown[];
  /** Messages the controller accepted once the workspace came up. */
  delivered: string[];
  sessionLookups: number;
  ensureRequests: number;
  controllerCreates: number;
  steerAttempts: number;
}

interface StubPreparingSessionOptions {
  failDispatch?: boolean;
  failWorkspace?: boolean;
  materialized?: boolean;
}

function readSentMessage(body: unknown): string {
  if (typeof body !== 'object' || body === null) return '';
  if ('message' in body && typeof body.message === 'string') return body.message;
  return '';
}

function readSentFiles(body: unknown): unknown[] {
  if (typeof body !== 'object' || body === null || !('files' in body)) return [];
  return Array.isArray(body.files) ? body.files : [];
}

/**
 * Models the controller's own hold: `POST .../messages` resolves the session
 * before sending, and resolving the session is what provisions the workspace.
 */
function stubPreparingSession({
  failDispatch = false,
  failWorkspace = false,
  materialized = false,
}: StubPreparingSessionOptions = {}): PreparingSession {
  let releaseWorkspace = () => {};
  const workspaceReady = new Promise<void>(resolve => {
    releaseWorkspace = resolve;
  });
  // the stream only opens once the session resolves, which is when messages land too
  let attachSse = (_controller: ReadableStreamDefaultController<Uint8Array>) => {};
  const sseOpen = new Promise<ReadableStreamDefaultController<Uint8Array>>(resolve => {
    attachSse = resolve;
  });
  const result: PreparingSession = {
    finishWorkspace: releaseWorkspace,
    posted: [],
    postedFiles: [],
    delivered: [],
    steerAttempts: 0,
    controllerCreates: 0,
    sessionLookups: 0,
    ensureRequests: 0,
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
    http.get(`${TEST_BASE_URL}/web/user-sessions/:sessionId`, () => {
      result.sessionLookups += 1;
      return HttpResponse.json({
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
      });
    }),
    http.get(`${TEST_BASE_URL}/web/github/projects/:projectRepositoryId/sessions`, () =>
      HttpResponse.json({ sessions: [] }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/:factoryProjectId/work-items`, () =>
      HttpResponse.json({ workItems: [] }),
    ),
    http.get(`${TEST_BASE_URL}/web/github/subscriptions`, () => HttpResponse.json({ subscriptions: [] })),
    http.post(`${TEST_BASE_URL}/web/github/projects/:projectRepositoryId/ensure`, () => {
      result.ensureRequests += 1;
      return HttpResponse.json({ resourceId: SESSION_ID, sandboxId: null, sandboxWorkdir: '/workspace/preparing' });
    }),
    http.post(`${API}/sessions`, async () => {
      result.controllerCreates += 1;
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
              attachSse(controller);
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
      const body = await request.json();
      result.posted.push(readSentMessage(body));
      result.postedFiles = readSentFiles(body);
      await workspaceReady;
      if (failWorkspace) return HttpResponse.json({ message: 'Clone failed' }, { status: 500 });
      if (failDispatch) return HttpResponse.json({ message: 'Sandbox is gone' }, { status: 500 });
      result.delivered.push(readSentMessage(body));
      // a real turn runs on delivery; agent_end is what releases the pending latch
      void sseOpen.then(controller => controller.enqueue(new TextEncoder().encode('data: {"type":"agent_end"}\n\n')));
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
  it('sends the message straight away and shows it while the workspace comes up', async () => {
    const session = stubPreparingSession();
    const user = userEvent.setup();

    const { client } = renderThread();

    const message = () => screen.getByRole('textbox', { name: 'Message' });
    await waitFor(() => expect(message()).toBeEnabled());
    await waitFor(() => expect(screen.getByText('Preparing workspace…')).toBeInTheDocument());

    await user.type(message(), 'fix the login bug');
    await user.keyboard('{Enter}');

    await waitFor(() => expect(screen.getByText('fix the login bug')).toBeInTheDocument());
    await waitFor(() => expect(session.posted).toEqual(['fix the login bug']));
    expect(session.delivered).toEqual([]);

    session.finishWorkspace();
    await waitForMutationsIdle(client);

    await waitFor(() => expect(session.delivered).toEqual(['fix the login bug']));
    expect(screen.getAllByText('fix the login bug')).toHaveLength(1);

    await user.type(message(), 'follow up');
    await user.keyboard('{Enter}');
    await waitForMutationsIdle(client);

    await waitFor(() => expect(session.delivered).toEqual(['fix the login bug', 'follow up']));
    expect(session.steerAttempts).toBe(0);
  });

  it('delivers a message once even when the sender navigates away before the workspace is up', async () => {
    const session = stubPreparingSession();
    const user = userEvent.setup();

    const { client } = renderThread();

    const message = () => screen.getByRole('textbox', { name: 'Message' });
    await waitFor(() => expect(message()).toBeEnabled());
    await waitFor(() => expect(screen.getByText('Preparing workspace…')).toBeInTheDocument());

    await user.type(message(), 'fix the login bug');
    await user.keyboard('{Enter}');
    await waitFor(() => expect(session.posted).toEqual(['fix the login bug']));

    await user.click(screen.getByText('go-away'));
    await user.click(screen.getByText('go-thread'));

    session.finishWorkspace();
    await waitForMutationsIdle(client);

    await waitFor(() => expect(session.delivered).toEqual(['fix the login bug']));
    expect(session.posted).toEqual(['fix the login bug']);
    expect(session.steerAttempts).toBe(0);
  });

  it('keeps messages in order and never steers a session with no run to steer', async () => {
    const session = stubPreparingSession();
    const user = userEvent.setup();

    const { client } = renderThread();

    const message = () => screen.getByRole('textbox', { name: 'Message' });
    await waitFor(() => expect(message()).toBeEnabled());
    await waitFor(() => expect(screen.getByText('Preparing workspace…')).toBeInTheDocument());

    await user.type(message(), 'fix the login bug');
    await user.keyboard('{Enter}');
    await waitFor(() => expect(session.posted).toEqual(['fix the login bug']));

    await user.type(message(), 'and add a test');
    await user.keyboard('{Enter}');
    await waitFor(() => expect(session.posted).toEqual(['fix the login bug', 'and add a test']));

    expect(session.steerAttempts).toBe(0);
    expect(screen.getByText('Preparing workspace…')).toBeInTheDocument();

    session.finishWorkspace();
    await waitForMutationsIdle(client);

    await waitFor(() => expect(session.delivered).toEqual(['fix the login bug', 'and add a test']));
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

    await waitFor(() => expect(session.delivered).toEqual(['fix the login bug']));
  });

  it('reports a failed send once, not once per reporter', async () => {
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
    expect(screen.queryByRole('button', { name: 'Abort' })).not.toBeInTheDocument();
  });

  it('surfaces the workspace failure when the session cannot come online', async () => {
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

    await waitFor(() => expect(screen.getAllByText(/Clone failed/).length).toBeGreaterThan(0));
    expect(screen.getAllByText('fix the login bug')).toHaveLength(1);
    expect(session.delivered).toEqual([]);
  });

  it('carries an image attached while the workspace prepares', async () => {
    const session = stubPreparingSession();
    const user = userEvent.setup();

    const { container, client } = renderThread();

    const message = () => screen.getByRole('textbox', { name: 'Message' });
    await waitFor(() => expect(message()).toBeEnabled());
    await waitFor(() => expect(screen.getByText('Preparing workspace…')).toBeInTheDocument());

    const form = container.querySelector('form');
    assert(form);
    fireEvent.drop(form, { dataTransfer: { files: [new File(['png'], 'shot.png', { type: 'image/png' })] } });
    expect(await screen.findByRole('button', { name: 'Remove image' })).toBeInTheDocument();

    await user.type(message(), 'what is wrong here');
    await user.keyboard('{Enter}');

    await waitFor(() => expect(session.posted).toEqual(['what is wrong here']));
    expect(session.postedFiles).toHaveLength(1);

    await releaseSession(session.finishWorkspace, client);
  });

  it('keeps a slash command in the composer, since commands act on a live session', async () => {
    const session = stubPreparingSession();
    const user = userEvent.setup();

    const { client } = renderThread();

    const message = () => screen.getByRole('textbox', { name: 'Message' });
    await waitFor(() => expect(message()).toBeEnabled());
    await waitFor(() => expect(screen.getByText('Preparing workspace…')).toBeInTheDocument());

    await user.type(message(), '/goal ship it');
    await user.keyboard('{Enter}');

    await waitFor(() => expect(screen.getByText('Commands run once the session is ready.')).toBeInTheDocument());
    expect(message()).toHaveValue('/goal ship it');
    expect(session.posted).toEqual([]);

    await releaseSession(session.finishWorkspace, client);
  });

  it('runs local slash commands while preparing', async () => {
    const session = stubPreparingSession();
    const user = userEvent.setup();

    const { client } = renderThread();

    const message = () => screen.getByRole('textbox', { name: 'Message' });
    await waitFor(() => expect(message()).toBeEnabled());
    await waitFor(() => expect(screen.getByText('Preparing workspace…')).toBeInTheDocument());

    await user.type(message(), '/help');
    await user.keyboard('{Enter}');

    expect(await screen.findByText(/Available commands:/)).toBeInTheDocument();
    expect(message()).toHaveValue('');
    expect(session.posted).toEqual([]);

    await releaseSession(session.finishWorkspace, client);
  });
});
